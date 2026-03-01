---
layout: page
title: "Tool-Use DPO: Schema-Constrained Alignment via Identity Preference Optimization"
description: "LLM alignment for rigid API contract adherence using IPO with hard negatives"
importance: 7
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Tool-Use-DPO
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Tool-Use-DPO)

## Overview

Tool-Use DPO addresses a critical production failure mode: LLMs generating tool calls that are **syntactically valid JSON but violate the API schema** — wrong types (`"5"` instead of `5`), hallucinated parameters, invalid enum values, missing required fields. The system implements a two-stage pipeline (SFT cold start → DPO with **Identity Preference Optimization**) trained on GPT-4o-generated **hard negative** preference pairs — rejected responses that are valid JSON but fail schema validation in exactly the ways real models fail. Using Qwen2.5-Coder-7B-Instruct with RSLoRA (rank 32, all 7 projection modules), the method achieves a **3.1× improvement in Strict Schema Pass Rate** (7.48% → 23.19%) with **67% fewer JSON syntax errors** and **22% fewer missing required fields** on 802 diverse tool-calling samples.

## The Hard Negative Philosophy

The core insight: **easy negatives don't teach discrimination**. Malformed JSON or gibberish is trivially distinguishable — models already avoid obvious garbage. Instead, the training data contains rejected responses that are plausible, syntactically correct JSON that fails in precisely the four ways production models fail:

| Error Category | Example |
|---------------|---------|
| **Type Mismatch** | `"limit": "10"` instead of `"limit": 10` |
| **Enum Violation** | `"priority": "urgent"` when schema allows `["high", "medium", "low"]` |
| **Hallucinated Parameter** | Adding `"verbose": true` when no such field exists in the schema |
| **Missing Required** | Omitting a mandatory `"title"` field |

Each training triplet `(prompt, chosen, rejected)` carries its own JSON Schema, enabling the model to generalize across diverse API contracts rather than memorizing a fixed schema.

## Synthetic Data Generation

GPT-4o generates triplets with a structured system prompt enforcing the hard negative constraint. Every generated sample passes through a **strict validation gate** before inclusion:

```python
chosen_valid, _ = validate_tool_call(chosen_str, schema)    # Must pass
rejected_valid, _ = validate_tool_call(rejected_str, schema)  # Must fail

if chosen_valid and not rejected_valid:
    accept(sample)   # Correct: chosen passes, rejected fails
else:
    discard(sample)   # GPT-4o made an error — self-correcting pipeline
```

Validation uses the `jsonschema` library with full Draft 4/6/7 support, including `additionalProperties` checks. The `extract_json()` utility handles models wrapping output in markdown code blocks or embedding JSON in surrounding text via brace-depth matching.

## Two-Stage Training Pipeline

### Stage 1: SFT Cold Start

Format-tuning phase teaching the model to output raw JSON with proper ChatML structure (`<|im_start|>`/`<|im_end|>` delimiters). Uses only `(prompt, chosen)` pairs from the DPO triplets.

| Parameter | Value |
|-----------|-------|
| Learning rate | `3e-5` |
| Epochs | 6 |
| Batch size | 8 × 2 gradient accumulation = **16 effective** |
| Warmup | 100 steps |
| Optimizer | `adamw_8bit` |

**Why SFT first?** DPO alone struggles without foundational format knowledge. The SFT stage ensures the model can reliably produce JSON before learning *which* JSON to prefer — without this, the DPO signal is too noisy to distinguish "bad format" from "bad content."

### Stage 2: DPO with IPO Loss

Preference optimization using the SFT checkpoint as initialization.

| Parameter | Value |
|-----------|-------|
| Learning rate | `1e-6` (30× smaller than SFT) |
| Epochs | 3 |
| Batch size | 4 × 4 gradient accumulation = **16 effective** |
| Beta | 0.05 |
| Loss type | **IPO** (Identity Preference Optimization) |
| Max prompt length | 768 tokens |
| Reference model | `None` (implicit via PEFT adapter trick) |

## Why IPO over Standard DPO

IPO (Azar et al., 2023) replaces DPO's log-sigmoid loss with a **squared error** objective targeting an explicit margin:

```
L_IPO = ( log(π(y_w|x)/π_ref(y_w|x)) − log(π(y_l|x)/π_ref(y_l|x)) − 1/(2β) )²
```

| Property | DPO | IPO |
|----------|-----|-----|
| Loss shape | Log-sigmoid (saturates) | Squared error (no saturation) |
| Gradient behavior | Vanishes for well-separated pairs | Constant pressure toward target margin |
| Small-data stability | Prone to overfitting | Robust with ~500 samples |
| Target margin | Implicit (maximize gap) | Explicit: `1/(2β) = 10` |

With `β = 0.05`, the target margin `1/(2β) = 10` creates strong pressure to separate chosen from rejected. IPO's non-saturating loss is critical with only ~500 synthetic training samples where standard DPO would overfit.

**Implicit reference model**: Setting `ref_model=None` in TRL's `DPOTrainer` leverages the PEFT adapter architecture — the frozen base model weights serve as the implicit reference while the LoRA delta represents the policy. This **halves GPU memory** by avoiding a separate reference model copy.

## Model Architecture

| Component | Specification |
|-----------|---------------|
| **Base Model** | Qwen2.5-Coder-7B-Instruct (4-bit NF4 via Unsloth) |
| **LoRA Rank / Alpha** | 32 / 64 (alpha/r = 2.0) |
| **LoRA Targets** | All 7 projections: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **RSLoRA** | Enabled — normalizes scaling by `1/√r` instead of `1/r`, preventing gradient explosion with high-rank adapters |
| **Dropout** | 0 (optimized for Unsloth) |
| **Gradient Checkpointing** | Unsloth-optimized variant |

**Rank 32** is unusually high for LoRA (typical: 8–16), giving the adapter significantly more capacity — justified for a task requiring fine-grained structural understanding of JSON schema constraints across diverse API contracts.

## Evaluation: Strict Schema Pass Rate (SSPR)

SSPR is a **binary, all-or-nothing** metric: a response either fully conforms to the schema or it does not. No partial credit.

Failures are classified into 6 categories via `jsonschema.validate()` error messages: `json_error`, `hallucinated_param` (`"Additional properties"`), `type_mismatch` (`"is not of type"`), `enum_violation` (`"is not one of"`), `missing_required` (`"is a required property"`), and `other_schema_error`.

Evaluation uses greedy decoding (`max_new_tokens=128`) with the same ChatML prompt template used during training. Both baseline and DPO models are evaluated on identical data for direct comparison.

## Results

| Metric | Baseline | DPO-Aligned | Change |
|--------|:--------:|:-----------:|:------:|
| **SSPR** | 7.48% | **23.19%** | **3.1×** |
| JSON syntax errors | — | — | **−67%** |
| Missing required fields | — | — | **−22%** |

Evaluated on **802 diverse tool-calling samples**. The 3.1× improvement demonstrates that hard negative preference learning effectively teaches subtle schema constraint satisfaction that SFT alone cannot achieve.

## Tech Stack

Python, PyTorch (2.2+), Hugging Face Transformers, TRL (DPOTrainer, DPOConfig), Unsloth (FastLanguageModel), PEFT (RSLoRA), bitsandbytes (NF4), jsonschema, OpenAI GPT-4o, Datasets, Accelerate

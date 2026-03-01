---
layout: page
title: "Vision-R1: Visual System 2 Reasoning via GRPO"
description: "A VLM trained with SFT, expert iteration, and GRPO to generate grounded chain-of-thought reasoning over visual math problems"
importance: 11
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Vision-R1
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Vision-R1)

## Overview

Vision-R1 extends the **DeepSeek-R1 paradigm** — using reinforcement learning to induce explicit chain-of-thought reasoning — to the **vision-language domain**. Most VLMs operate in "System 1" mode (fast, reactive answering) and lack the ability to perform deliberate, step-by-step visual reasoning. The system teaches Qwen2.5-VL-7B to (1) **parse visual information** explicitly via `<visual_parse>` tags, (2) **reason step-by-step** via `<think>` tags, and (3) **produce verifiable answers** via `\boxed{}` notation — through a three-phase pipeline progressing from supervised imitation to reinforcement learning with **decomposed rule-based process supervision** (no neural reward model). The reward function decomposes into four interpretable components — correctness (0.5), spatial grounding (0.2), symbolic verification (0.2), and format compliance (0.1) — providing fine-grained credit assignment without reward model training overhead. On Geometry3K, the system achieves **~45% Pass@1** (vs. ~5% base model) with **~65% Pass@16** via majority voting, while blind baseline ablation (black-image inputs) confirms genuine visual grounding rather than textual shortcut exploitation.

## Relationship to DeepSeek-R1

| Aspect | DeepSeek-R1 | Vision-R1 |
|--------|-------------|-----------|
| **Domain** | Text-only reasoning (math, code) | Visual + spatial reasoning |
| **Base model** | DeepSeek-V3 | Qwen2.5-VL-7B |
| **RL algorithm** | GRPO | GRPO (same) |
| **Reasoning format** | `<think>` tags | `<visual_parse>` + `<think>` tags |
| **Reward model** | Trained neural RM | Rule-based decomposed rewards |
| **Key addition** | — | Visual grounding verification + spatial coordinate validation |

The fundamental contribution is adapting "reasoning via RL" for **multimodal inputs** where the model must ground its reasoning in visual perception, not just textual context — introducing `<visual_parse>` as an auditable "perception checkpoint" that separates visual processing from logical reasoning.

## Three-Phase Training Pipeline

### Phase 1: SFT Cold Start

Bootstraps the structured reasoning format through next-token prediction on annotated reasoning traces. Data is JSONL with `(image, question, answer, completion)` tuples where completions follow the `<visual_parse>` → `<think>` → `\boxed{}` format.

| Parameter | Value |
|-----------|-------|
| Learning rate | `2e-5` |
| Batch size | 4 × 4 gradient accumulation = **16 effective** |
| Epochs | 3 |
| Warmup ratio | 0.1 |
| Weight decay | 0.01 |
| Max sequence length | 2,048 tokens |
| Precision | BFloat16 |

Uses `SFTTrainer` from TRL with a custom `qwen_sft_collator()` that combines prompt + completion, processes images via Qwen processor, and sets `labels = input_ids.clone()` for standard causal LM training.

### Phase 1.5: Expert Iteration (Optional)

Rejection sampling to narrow the policy distribution toward correct trajectories before RL — inspired by AlphaGeometry:

1. Generate **K=16 candidate solutions** per problem using temperature sampling
2. Extract answers via `\boxed{}` or `<answer>` tags with numeric tolerance
3. Retain only correct solutions as curated training data
4. Track coverage (problems with ≥1 correct), pass rate, and average correct samples per problem

This bridges SFT and GRPO by filtering the model's own generations for correctness, improving GRPO stability.

### Phase 2: GRPO Reinforcement Learning

Group Relative Policy Optimization refines reasoning quality beyond SFT — samples G=4 completions per prompt, computes group-relative advantages (no critic network needed), and updates the policy with KL penalty against the SFT reference.

| Parameter | Value |
|-----------|-------|
| Learning rate | `1e-5` |
| Batch size | 2 × 8 gradient accumulation = **16 effective** |
| Epochs | 3 |
| GRPO group size | 4 completions per prompt |
| KL penalty (β) | 0.1 |
| Temperature | 0.7 |
| Top-p | 0.95 |
| Repetition penalty | 1.1 |
| Max completion length | 1,024 tokens |

## Decomposed Rule-Based Reward System

Rather than training a neural reward model (expensive, prone to reward hacking), Vision-R1 uses **four interpretable, orthogonal reward components** providing fine-grained credit assignment:

### Format Reward (weight: 0.1)

Regex-based structural validation:
- `<think>...</think>` tags present: +0.3
- `\boxed{}` or `<answer>` tags present: +0.3
- `<visual_parse>...</visual_parse>` tags present: +0.2
- All tags properly closed (balanced): +0.2
- Unclosed tags: penalty (score < 0.3)

### Grounding Reward (weight: 0.2)

Validates spatial coordinate outputs in `[x1, y1, x2, y2]` format:
- Extracts coordinate arrays via regex
- Bounds check: all values in [0, 1000]
- Ordering check: `x1 < x2` and `y1 < y2` (valid bounding box geometry)
- Awards 0.2 per valid coordinate set, capped at 1.0

### Symbolic Verification Reward (weight: 0.2)

Validates mathematical equations in reasoning traces:
- Converts caret notation (`^`) to Python power syntax (`**`)
- Parses equations using SymPy's `sympify()` for syntactic validity
- Awards points per valid equation, capped at 1.0
- Graceful fallback if SymPy unavailable

### Correctness Reward (weight: 0.5)

Binary (0 or 1) with cascading matchers:
1. Extract predicted answer from `\boxed{}` using a **depth-tracking brace parser** (handles nested braces like `\boxed{\frac{a^{2}}{b^{2}}}`)
2. Symbolic verification via `math_verify` library
3. Numeric comparison with tolerance (1e-6)
4. Case-insensitive string matching fallback

**Length penalty** (additional): Graduated penalty for responses exceeding 2,048 characters (max −0.5), discouraging verbose, unfocused reasoning.

## Model Architecture

| Component | Specification |
|-----------|---------------|
| **Base Model** | Qwen2.5-VL-7B-Instruct (NaViT vision encoder + language decoder) |
| **Dynamic Resolution** | 256×28×28 to 1280×28×28 pixels |
| **LoRA Rank / Alpha** | 64 / 128 (alpha/r = 2.0) |
| **LoRA Targets** | All 7 projections: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **LoRA Dropout** | 0.05 |
| **Modules to save** | `embed_tokens`, `lm_head` (fully trainable, not LoRA-adapted — critical for VLM fine-tuning stability) |
| **Trainable parameters** | ~3–5% of total |
| **Precision** | BFloat16 |
| **Attention fallback** | Flash Attention 2 → SDPA → Eager (auto-detected) |

The `modules_to_save` configuration ensures embedding and output layers are fully trainable rather than LoRA-adapted — noted as critical for stable VLM fine-tuning where the model must learn to map between visual tokens and reasoning output.

## Inference: Generation Priming + Best-of-N

During inference, generation is **primed by appending `<think>` to the prompt**, forcing the model into its trained reasoning mode from the first token. Best-of-N sampling generates N candidates with temperature > 0, extracts answers from each via `\boxed{}`, and applies **majority voting** using frequency-based selection for the final answer.

## Evaluation and Ablation Studies

### Results

| Configuration | Pass@1 | Pass@16 (Majority Vote) |
|--------------|:------:|:-----------------------:|
| Base model (Qwen2.5-VL-7B) | ~5% | ~10% |
| + SFT (Phase 1) | ~35% | ~50% |
| **+ SFT + GRPO (Phase 1 + 2)** | **~45%** | **~65%** |
| Blind baseline (black images) | ~5% | ~5% |

**Key findings**: (1) SFT provides a **+30pp** improvement (5% → 35%), demonstrating the value of structured reasoning format. (2) GRPO adds **+10pp** beyond SFT (35% → 45%), demonstrating RL-based reasoning quality improvement. (3) Majority voting at test-time provides **+20pp** additional gains (45% → 65%), validating test-time compute scaling. (4) Blind baseline equals random chance (~5%), **confirming genuine visual grounding** — the model actually uses image content.

### Three Ablation Experiments

**Blind Baseline Comparison**: Replaces all images with 224×224 black squares. Performance drop >10% confirms genuine visual grounding vs. textual shortcut exploitation.

**Thinking Length Scaling**: Bins reasoning tokens into ranges (0–50, 50–100, ..., 1000+) and computes per-bin accuracy with correlation coefficients and polynomial trend fitting. Demonstrates that more thinking leads to better answers — evidence for test-time compute scaling analogous to DeepSeek-R1 and OpenAI o1.

**SFT vs. RL Comparison**: Compares accuracy across three stages (base, +SFT, +SFT+GRPO) with delta annotations, isolating each phase's contribution.

### Pass@k Implementation

Uses the unbiased estimator: `Pass@k = 1 − C(n−c, k) / C(n, k)` where `n` = total samples, `c` = correct samples, with overflow prevention and edge-case handling.

## Tech Stack

Python (3.10+), PyTorch (2.4+), Hugging Face Transformers (4.45+), TRL (GRPOTrainer, SFTTrainer), PEFT (LoRA), Qwen2.5-VL-7B, Flash Attention 2, SymPy (symbolic verification), math_verify, Weights & Biases, Matplotlib, Gradio (interactive demo)

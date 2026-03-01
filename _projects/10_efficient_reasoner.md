---
layout: page
title: "Efficient-Reasoner: Adaptive Compute Allocation via Reinforcement Learning"
description: "An RL-trained LLM routing between System 1 and System 2 reasoning"
importance: 10
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Efficient-Reasoner
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Efficient-Reasoner)

## Overview

Efficient-Reasoner treats tool invocation as a **learnable policy** rather than a fixed pipeline component, training a language model to dynamically route between fast direct reasoning (System 1) and slow tool-augmented retrieval (System 2) via **Group Relative Policy Optimization (GRPO)**. The core insight — inspired by Kahneman's dual-process framework — is that most LLM agent systems invoke external tools unconditionally, but a significant fraction of queries can be answered from parametric memory alone. By designing a multi-component reward function that penalizes tool usage (`−0.05` per call) while bonusing correct direct answers (`+0.1`), the GRPO-trained 3B-parameter model discovers a cost-benefit decision boundary purely from the reward signal, **maintaining ~65% accuracy while reducing token generation by 40% and tool calls by 60%** compared to always-search baselines. The system implements a complete two-phase pipeline (SFT cold start → GRPO optimization) with a sub-millisecond mock retrieval environment enabling >1,000 RL training steps/hour, Pareto frontier analysis for accuracy-vs-cost trade-off visualization, and 4-bit QLoRA training on consumer GPUs (8GB+ VRAM).

## Dual-Process Reasoning Architecture

The model generates structured XML output following an agentic Think → Call → Observe → Answer protocol:

```xml
<thought>Step-by-step reasoning about whether retrieval is needed...</thought>
<call>search_wiki("query")</call>
<obs>Retrieved information from knowledge base...</obs>
<answer>Final answer</answer>
```

The system prompt instructs the model to **think before searching** — if confident, output `<answer>` directly (System 1); if uncertain, invoke `<call>` for retrieval (System 2). After GRPO training, this routing behavior **emerges naturally from the reward signal** without explicit complexity classification — the model learns to skip retrieval for common knowledge questions and invoke it for obscure factual queries.

**Custom stopping criteria** (`StopOnXMLTags`) monitors generation for `</call>` and `</answer>` tags, enabling mid-generation tool execution: when `</call>` is detected, generation pauses, the tool executes, results are injected as `<obs>` tags into context, and generation resumes.

## Two-Phase Training Pipeline

### Phase 1: SFT Cold Start (~30 min)

Format-tuning phase teaching the model the XML tool-call protocol. Synthetic reasoning traces are generated from HotpotQA data with a controlled distribution:

| Trace Type | Distribution | Pattern |
|-----------|:-----------:|---------|
| **Direct answer** | 20% | `<thought>` → `<answer>` (no tool calls) |
| **Single-search** | 60% | `<thought>` → `<call>` → `<obs>` → `<answer>` |
| **Multi-hop** | 20% | Multiple `<call>`/`<obs>` pairs before `<answer>` |

A heuristic `is_simple_question()` classifier routes questions to the appropriate trace type. Training uses `SFTTrainer` from TRL with `lr=2e-5`, batch size 4 × 2 gradient accumulation, 3 epochs, max sequence length 1,024.

### Phase 2: GRPO Optimization (~2–4 hrs, A100)

The core policy optimization phase where the model learns *when* to use tools.

| Parameter | Value |
|-----------|-------|
| Algorithm | GRPO (Group Relative Policy Optimization) |
| Group size | 8 completions per prompt |
| KL penalty (β) | 0.04 |
| Learning rate | `2e-5` with cosine decay + 10% warmup |
| Batch size | 4 × 4 gradient accumulation = **16 effective** |
| Max steps | 500 |
| Max prompt length | 1,024 tokens |
| Max completion length | 1,024 tokens |
| Checkpoint interval | Every 100 steps (max 3 kept) |
| Precision | bf16 (auto-detected) |

**Why GRPO over PPO**: GRPO eliminates the critic/value network entirely — instead of training a separate value head, advantages are computed *relative to the group* of 8 completions per prompt. This is more parameter-efficient (no critic parameters) and more stable for sequence-level rewards where per-token value estimation is unreliable.

## Multi-Component Reward Function

The reward function encodes the cost-benefit trade-off between accuracy and computational efficiency:

```
R = Correctness + Format − Cost − IncompletePenalty + EfficientBonus
```

| Component | Condition | Value | Purpose |
|-----------|-----------|:-----:|---------|
| **Correctness** | Answer matches ground truth | **+1.0** | Primary accuracy signal |
| **Correctness** | Wrong answer | −0.5 | Penalty for incorrect responses |
| **Format** | Valid XML structure | +0.1 | Encourage parseable output |
| **Format** | Invalid XML | −0.5 | Penalize unparseable output |
| **Tool Cost** | Per tool call executed | **−0.05** | Core efficiency pressure |
| **Incomplete** | `<call>` without matching `<obs>` | −0.2 | Penalize unfinished reasoning |
| **Efficient Bonus** | Correct without any tools | **+0.1** | Reward confident direct answers |

The `−0.05` per-call cost and `+0.1` efficient bonus create a clear incentive gradient: for questions answerable from parametric memory, direct answers yield `+1.0 + 0.1 + 0.1 = +1.2` reward, while unnecessary single-search answers yield `+1.0 + 0.1 − 0.05 = +1.05`. The 0.15 margin is sufficient for GRPO to learn the routing policy.

**Correctness assessment** uses fuzzy matching with multiple strategies: exact match (after normalization), case-insensitive comparison, containment detection, and word-level subset matching.

## Mock Retrieval Environment

A sub-millisecond knowledge base simulator enabling fast RL training without API latency:

**Three-tier retrieval cascade**:
1. **O(1) exact match** — Dictionary lookup on normalized titles
2. **O(N) partial match** — Substring search across all keys
3. **O(N) content search** — Full-text search across paragraph content

Results are truncated to 500 characters maximum. The environment supports single-query (`search_wiki`), batch multi-query (`search_wiki_multi`), and entity lookup (`get_entity_info`) tool functions. Data is sourced from HotpotQA's distractor subset (pre-built JSON indices or freshly constructed).

**Performance impact**: Sub-millisecond latency enables >1,000 GRPO training steps/hour, compared to ~100 steps/hour with live Wikipedia API calls — a **10× throughput improvement** that makes RL training on agentic reasoning tractable.

## Model Architecture

| Component | Specification |
|-----------|---------------|
| **Base Model** | Qwen2.5-3B-Instruct (3B parameters) |
| **Quantization** | 4-bit NF4 with double quantization via bitsandbytes (~75% VRAM reduction) |
| **LoRA Rank / Alpha** | 16 / 32 (alpha/r = 2.0) |
| **LoRA Targets** | All 7 projections: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **LoRA Dropout** | 0.05 |
| **Trainable parameters** | ~0.5% of total |
| **Optimizer** | 8-bit AdamW (memory-efficient) |
| **Gradient checkpointing** | Enabled |

**Graceful degradation chain**: Unsloth (4× faster training) → standard Transformers + bitsandbytes → CPU float32. Device detection: CUDA → MPS (Apple Silicon) → CPU.

## Agentic Inference Loop

The inference system implements a Think → Call → Execute → Observe → Resume cycle with 5 safety mechanisms:

1. **Max agentic steps**: 5 (configurable) — bounds the reasoning depth
2. **Per-step token budget**: 256 new tokens maximum
3. **Stuck detection**: N-gram diversity analysis via `detect_stuck_generation()` — if diversity drops below threshold within 50 tokens, generation is terminated
4. **Context length monitoring**: 80% max context ratio triggers warning/truncation with 256-token safety margin
5. **Unclosed tag detection**: Regex-based detection of incomplete `<call>` and `<obs>` tags

## Results

| Configuration | Accuracy | Avg Tokens | Avg Tool Calls |
|--------------|:--------:|:----------:|:--------------:|
| Base (zero-shot) | ~40% | ~200 | ~1.5 |
| SFT (always search) | ~65% | ~450 | ~2.0 |
| **GRPO (learned policy)** | **~65%** | **~270** | **~0.8** |

**Key findings**: (1) GRPO matches SFT accuracy while using **40% fewer tokens** and **60% fewer tool calls**, validating that tool-use is a learnable policy. (2) The model exhibits emergent dual-process behavior — fast direct answers for common knowledge, deliberate multi-hop retrieval for obscure facts — purely from the reward signal without explicit complexity classification. (3) Base model's ~1.5 tool calls reflect uncontrolled, often malformed attempts, demonstrating that SFT is necessary for format learning before GRPO can optimize the policy.

## Pareto Frontier Analysis

The evaluation framework generates accuracy-vs-tokens Pareto frontier visualizations via dominance checking (no point simultaneously higher accuracy and lower tokens). Models are color-coded (base: red, SFT: teal, GRPO: blue) with the "efficient zone" (top-left quadrant) highlighted. The GRPO checkpoint occupies the Pareto-optimal position — maximum accuracy at minimum computational cost.

**Ablation support**: Multi-checkpoint evaluation (`eval/benchmark.py`) automatically compares base, SFT, and GRPO configurations with result caching, GPU memory monitoring, and per-sample detailed results for post-hoc analysis.

## Tech Stack

Python (3.10+), PyTorch (2.4+), Hugging Face Transformers (4.44+), TRL (GRPOTrainer, SFTTrainer), PEFT (LoRA), bitsandbytes (NF4), Accelerate, Unsloth (optional 4× speedup), Datasets (HotpotQA), Matplotlib, NumPy

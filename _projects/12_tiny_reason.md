---
layout: page
title: "Tiny-Reason: Distilling Reasoning into 1.5B Parameter Models"
description: "A QLoRA fine-tuning pipeline distilling chain-of-thought reasoning into a 1.5B model"
importance: 12
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Tiny-Reason
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Tiny-Reason)

## Overview

Tiny-Reason demonstrates that **explicit mathematical reasoning can be distilled into a 1.5B-parameter model** using structured chain-of-thought supervision and extreme parameter efficiency — training only **~1.3M parameters (0.087% of total)** via QLoRA on just **2,000 GSM8K samples** in **~45 minutes on a free Google Colab T4** with 6GB VRAM. The approach is deliberately simple: pure supervised fine-tuning (no RL, no reward model, no teacher distillation) on human-written reasoning traces reformatted into structured `<think>` tags within ChatML templates. LoRA adapters are applied to **all 7 projection matrices** per transformer block — including the SwiGLU FFN components (`gate_proj`, `up_proj`, `down_proj`) — a deliberate divergence from standard LoRA practice based on the insight that mathematical computation relies heavily on feed-forward layers, not just attention. The fine-tuned model achieves **35–45% accuracy** on held-out GSM8K test samples (vs. ~30% base model), demonstrating meaningful reasoning capability transfer despite extreme resource constraints.

## Structured CoT Data Pipeline

The `GSM8KProcessor` transforms raw GSM8K samples into a reasoning-friendly training format by parsing the `####` delimiter separating step-by-step reasoning from final answers, then wrapping them in structured tags within Qwen's ChatML template:

```
<|im_start|>system
You are a helpful assistant that solves math problems step-by-step.<|im_end|>
<|im_start|>user
[question]<|im_end|>
<|im_start|>assistant
<think>
[step-by-step reasoning from GSM8K]
</think>

**Final Answer:** [numerical answer]<|im_end|>
```

This creates **three distinct gradient-receiving regions**: (a) the reasoning trace inside `<think>` tags, (b) the format delimiter, and (c) the answer value — teaching the model both problem decomposition and result extraction simultaneously. The structured `<think>` format mirrors the approach used by DeepSeek-R1, but adapted for ChatML templates.

At inference time, generation is **primed** by appending `<think>\n` to the prompt, forcing the model into its trained reasoning mode from the first token.

**Data processing**: 2,000 samples subsampled from GSM8K train split (shuffled with seed 3407), split 90/10 into 1,800 training + 200 validation samples. Malformed entries (missing `####`) are gracefully filtered while maintaining batch alignment.

## Model Architecture and QLoRA Configuration

| Component | Specification |
|-----------|---------------|
| **Base Model** | Qwen2.5-1.5B-Instruct (28 transformer layers) |
| **Quantization** | 4-bit NF4 via bitsandbytes (~0.8GB VRAM, down from ~3GB) |
| **LoRA Rank / Alpha** | 16 / 32 (alpha/r = 2.0) |
| **LoRA Dropout** | 0 |
| **LoRA Targets** | All 7 projections: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **Trainable parameters** | ~1.3M (**0.087%** of 1.5B total) |
| **Gradient checkpointing** | Unsloth-optimized variant |
| **Max sequence length** | 2,048 tokens |
| **Precision** | BF16 on Ampere+ (A100, RTX 3090+), FP16 on Volta (T4) — auto-detected |

**Why LoRA on FFN layers**: Most LoRA implementations target only attention projections. Tiny-Reason deliberately includes all three SwiGLU FFN components (`gate_proj`, `up_proj`, `down_proj`) because mathematical computation relies heavily on the feed-forward pathway for numerical operations — attention captures *which* numbers to combine, but the FFN performs the *computation itself*. This adds minimal parameter overhead while significantly improving mathematical reasoning quality.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Per-device batch size | 2 |
| Gradient accumulation | 4 steps → **8 effective batch** |
| Max training steps | 250 |
| Learning rate | `2e-4` with linear decay |
| Warmup steps | 50 |
| Optimizer | `adamw_8bit` (8-bit AdamW) |
| Weight decay | 0.01 |
| Evaluation interval | Every 50 steps |
| Checkpoint saving | Every 50 steps (max 3 kept) |
| Best model selection | `load_best_model_at_end=True` on eval loss |
| Packing | Disabled (each sample occupies its own sequence) |

**Pure SFT approach**: No reinforcement learning, no reward model, no GRPO, no PPO. The reasoning capability comes entirely from structured CoT supervision and the standard causal language modeling loss (cross-entropy) applied to the formatted reasoning traces. This makes the approach maximally simple, reproducible, and accessible.

**Validation-guided checkpointing**: With only 250 training steps on 1,800 samples, overfitting is a real risk. The system evaluates every 50 steps on the 200-sample validation split and retains the best checkpoint, preventing degradation.

## Evaluation

Evaluation uses **greedy decoding** (`do_sample=False`, `max_new_tokens=512`) on 50 held-out GSM8K test samples. Predicted answers are extracted via regex (`\*\*Final Answer:\*\*\s*(.*?)`) and normalized through a semantically-aware pipeline:

- Strip whitespace, lowercase
- Remove commas/spaces from numbers (`"1,000"` → `"1000"`)
- Strip floating-point artifacts (trailing `.0`)
- Convert English word numbers to digits (`"zero"` through `"ten"` → 0–10)
- Remove currency symbols (`$`) and unit suffixes (`"dollars"`, `"meters"`, `"feet"`)

## Results

| Configuration | GSM8K Accuracy |
|--------------|:--------------:|
| Base Qwen2.5-1.5B-Instruct | ~30% |
| **Tiny-Reason (2K samples)** | **35–45%** |
| Frontier models (GPT-4, etc.) | 80–90%+ |

**+5–15 percentage points** improvement despite extreme constraints: 0.087% trainable parameters, 2,000 training samples, 250 steps, 45 minutes on free hardware. Demonstrates that structured chain-of-thought supervision transfers meaningful reasoning capability even to sub-2B models.

## Inference

Interactive REPL with **real-time token streaming** via `TextStreamer` from Transformers. Uses low-temperature sampling (`temperature=0.1`, `do_sample=True`) for near-deterministic but slightly varied outputs with `max_new_tokens=1024`.

## Reproducibility

Full deterministic seeding across Python random, NumPy, PyTorch CPU/CUDA, and `PYTHONHASHSEED`. Every checkpoint saves the exact experiment config YAML alongside model weights and tokenizer. Seed 3407 — a reference to the paper "Torch.manual_seed(3407) is all you need" showing this seed often produces favorable training dynamics.

## Tech Stack

Python (3.9+), PyTorch (2.1+), Hugging Face Transformers (4.38+), TRL (SFTTrainer), PEFT (LoRA), bitsandbytes (NF4 + 8-bit AdamW), Unsloth (optimized training kernels), Datasets (GSM8K), xformers

---
layout: page
title: "Nano-Reasoner: Unified Post-Training Framework for Math Reasoning Models"
description: "An end-to-end research-grade, memory-efficient post-training pipeline for reasoning models with SFT and RL"
importance: 1
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Nano-Reasoner
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Nano-Reasoner)

## Overview

Nano-Reasoner is a unified, research-grade post-training framework for training small language models to perform chain-of-thought mathematical reasoning via Reinforcement Learning from Verifiable Rewards (RLVR). The framework implements a complete two-phase pipeline — Supervised Fine-Tuning (SFT) cold start followed by RL optimization — with **six RL algorithms implemented from scratch in pure PyTorch** (no dependency on TRL or external RL libraries), achieving **84%+ accuracy on GSM8K** with a 1.5B-parameter model.

## Architecture

**Base Model**: Qwen2.5-Math-1.5B-Instruct (1.5B parameters) with ChatML-style tokenization.

**Parameter-Efficient Training**: LoRA adapters (rank 16, alpha 32) targeting all linear transformations — attention projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`) and MLP layers (`gate_proj`, `up_proj`, `down_proj`) — training only ~1–2% of total parameters.

**Memory Optimization Stack**: Three complementary techniques enable training on GPUs as small as 16GB:
- 4-bit NF4 quantization with double quantization via bitsandbytes (~8x weight storage reduction)
- LoRA adapters (minimal trainable parameters)
- Gradient checkpointing (Unsloth-optimized when available)

**Dual Backend Support**: Auto-detects and uses Unsloth's `FastLanguageModel` for optimized CUDA training, with graceful fallback to standard HuggingFace Transformers + PEFT + bitsandbytes on non-CUDA hardware. Flash Attention 2 is auto-detected for 2–3x attention speedup on A100/H100.

## Training Pipeline

### Phase 1: SFT Cold Start (~30 min, A100)

Format-tuning phase that teaches the model to emit `<think>...</think>` chain-of-thought reasoning traces and `\boxed{}` answer formatting — a prerequisite for RL, since the reward function requires structured output to extract and verify answers.
- Standard causal LM loss with padding-masked cross-entropy (ignore index `-100`)
- Learning rate: `2e-5`, batch size: 4, max 5,000 samples from OpenR1-Math-220K

### Phase 2: Reinforcement Learning (~10 hrs, A100)

Six RL algorithms with a unified rollout-and-optimize loop:
1. **Prompt expansion**: Each prompt replicated `G` times (default `G=8`) for group-based advantage estimation
2. **Rollout generation**: Sampling with `temperature=0.8`, `max_new_tokens=384`
3. **Binary reward**: Rule-based verification via `\boxed{}` extraction with nested brace handling (correct=1.0, incorrect=0.0)
4. **Old-policy log-probs**: Computed under `torch.no_grad()` for importance sampling ratios
5. **Inner optimization**: `ppo_epochs=2` gradient updates per rollout with `clip_grad_norm=1.0`
6. **Aggressive memory management**: Explicit tensor deletion, `gc.collect()`, and `torch.cuda.empty_cache()` after each step

## RL Algorithms

All algorithms are implemented from scratch in pure PyTorch with a unified interface — they share the same rollout/generation code and differ only in their loss computation:

**GRPO** (Group Relative Policy Optimization): Generates `G` completions per prompt, normalizes advantages within each group (mean/std), and optimizes a clipped surrogate objective (ε=0.2, clip range [0.8, 1.2]).

**Dr. GRPO** (Length-Corrected GRPO): Addresses length bias in vanilla GRPO by introducing a per-sample length correction factor `L_i / μ_L`, normalizing gradient contributions so that concise correct answers are not under-weighted relative to verbose ones. **Best-performing algorithm (84% GSM8K).**

**PPO** (Proximal Policy Optimization): Adds a learned value head (`nn.Linear(hidden_size, 1)`) with a separate AdamW optimizer (`lr=1e-4`). Implements Generalized Advantage Estimation (GAE) with `γ=0.99`, `λ=0.95` over sparse terminal rewards. Value loss (`0.5 × MSE`) added to the clipped surrogate objective.

**GSPO** (Group Sequence Policy Optimization): Replaces token-level importance ratios with a sequence-level geometric mean ratio `ρ_seq = exp(Σ log(π/π_old) / |seq|)`, providing more stable optimization for sequence-level rewards.

**DAPO** (Decoupled Clip and Dynamic Sampling): Two innovations — (1) dynamic sampling that filters out zero-variance prompt groups (all correct or all incorrect) since they provide no gradient signal, and (2) asymmetric clipping with a wider upper clip (1.28) for positive advantages to encourage exploitation of good actions.

**GRPO-LEAD** (Length and Difficulty Aware): Curriculum-style training with (1) a length penalty `exp(-0.1 × |z_score|)` on correct answers to encourage conciseness, and (2) difficulty weighting `(2.0 - pass_rate)` that up-weights harder problems (lower group pass rates) by up to 2x.

## Results

| Stage | GSM8K Accuracy | Training Time |
|-------|:--------------:|:-------------:|
| Base model (zero-shot) | ~65% | — |
| + SFT cold start | ~72% | ~30 min |
| + GRPO | ~82% | ~10 hrs |
| + Dr. GRPO | **~84%** | ~10 hrs |

**+19 percentage points** improvement over the base model on a 1.5B-parameter model, competitive with significantly larger models on the GSM8K grade-school math benchmark.

## Monitoring & Evaluation

- **Weights & Biases** integration for tracking loss, mean reward, KL divergence, policy entropy, average response length, and accuracy per training step
- Standalone evaluation script with greedy and temperature-controlled decoding, reporting Pass@1 accuracy on the GSM8K test split

## Tech Stack

Python, PyTorch, Hugging Face Transformers, PEFT (LoRA), bitsandbytes (NF4), Unsloth, Flash Attention 2, Accelerate, Weights & Biases

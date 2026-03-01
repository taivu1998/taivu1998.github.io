---
layout: page
title: "PRM-Math: Inference-Time Compute Scaling via Dense Process Supervision"
description: "Cutting-edge inference-time compute scaling strategies with a fine-tuned Process Reward Model"
importance: 2
category: "Artificial Intelligence"
github: https://github.com/taivu1998/PRM-Math
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/PRM-Math)

## Overview

PRM-Math is a complete implementation of inference-time compute scaling for mathematical reasoning through dense process supervision. The framework trains a **Generative Process Reward Model (PRM)** — formulated as conditional next-token prediction rather than a classification head — and deploys it across a hierarchy of test-time scaling strategies culminating in a full **Monte Carlo Tree Search (MCTS)** with learned value functions. On competition-level MATH-500 problems, MCTS achieves **54% accuracy — a +14pp absolute improvement** over the Pass@1 baseline, demonstrating that harder problems benefit disproportionately from intelligent search guided by step-level supervision.

## Process Reward Model Architecture

**Generative Verifier Paradigm**: Rather than adding a classification head atop a transformer (the standard reward model approach), the PRM is formulated as conditional next-token prediction. The model learns to predict `+` (correct) or `−` (incorrect) as the next token after a special `<|verify|>` delimiter:

```
Input:  Problem: {problem}\n\nSolution:\n{step_1}\n...\n{step_k}\n<|verify|>
Target: + or -
```

At inference time, the step-level confidence score is computed from the softmax distribution: `P(correct) = P("+") / (P("+") + P("-"))`. This requires **no architectural modifications** to the base LLM and leverages its full pretrained language modeling capability.

**Score Aggregation**: Two strategies combine per-step scores into solution-level scores:
- **Product (cumulative)**: `∏ step_scores` — models the joint probability that all steps are correct
- **Min (weakest link)**: `min(step_scores)` — penalizes the single worst step, robust to critical errors

## Training Pipeline

**Base Model**: Qwen2.5-Math-1.5B-Instruct (1.5B parameters, math-specialized).

**Dataset**: Math-Shepherd — step-labeled reasoning traces with per-step `+`/`−` correctness annotations. A custom parser extracts `(cumulative_context, step_text, label)` tuples with online class balancing (downsampling positives to maintain ~50/50 distribution).

**QLoRA Fine-Tuning**: 4-bit NF4 quantization via Unsloth with LoRA adapters (rank 16, alpha 16) targeting all linear layers — attention projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`) and MLP gates (`gate_proj`, `up_proj`, `down_proj`). Gradient checkpointing with Unsloth's optimized variant.

**Loss Masking**: A custom `DataCollatorForCompletionOnlyLM` masks the loss on all tokens before and including `<|verify|>`, computing cross-entropy **only on the single `+`/`−` verification token** — effectively training a binary classifier through the standard causal LM objective.

**Training Config**: LR `2e-4` with cosine decay, effective batch size 32 (8 × 4 gradient accumulation), 3% warmup, max sequence length 2048, 1 epoch. Adapters are merged back into the base model in 16-bit precision for deployment.

## Inference-Time Compute Strategies

Four strategies of escalating sophistication, enabling systematic study of test-time compute scaling:

**Best-of-N Reranking**: A dual-model architecture where the base model generates N diverse candidates via temperature sampling (T=0.8), and the trained PRM scores each step-by-step. The highest-scored solution is selected.

**Majority Voting**: Generates N candidates, extracts final answers via multi-pattern regex (LaTeX `\boxed{}`, `####`, natural language patterns, fraction/root evaluation), and returns the most frequent answer.

**PRM-Weighted Majority Voting**: Hybrid strategy weighting each vote by its PRM confidence score, allowing rare but highly-scored answers to outperform common low-scored ones. Equivalent answers are grouped after LaTeX normalization.

**Monte Carlo Tree Search with PRM Value Function**: The most sophisticated strategy, implementing a dual-model MCTS analogous to AlphaGo's architecture but applied to natural language reasoning:

- **Selection**: UCB (Upper Confidence Bound) with `c_puct=1.5` balancing exploitation vs. exploration: `UCB(child) = value + c_puct × prior × √(parent_visits) / (1 + child_visits)`
- **Expansion**: Generates `n_expand=3` candidate next steps using the base model. Per-token average log-probabilities serve as **prior policies** (guiding exploration toward likely continuations), normalized across siblings.
- **Evaluation**: The trained PRM scores the full solution path from root to the current node using step-product aggregation, serving as the **learned value function**. Values are cached on nodes to avoid recomputation.
- **Backpropagation**: Standard MCTS backup — increments visit count and propagates values to root.
- **Solution extraction**: Follows the most-visited path (standard MCTS convention), with greedy completion for incomplete terminal nodes.

**Checkpoint-Based Evaluation**: A key efficiency optimization — builds a single MCTS tree incrementally and records the best solution at multiple simulation budgets (1, 5, 10, 20, 50), avoiding redundant computation when comparing compute budgets.

## Results

**GSM8K** (grade-school math, N=16):

| Method | Accuracy |
|--------|:--------:|
| Pass@1 (baseline) | 82.0% |
| Majority@16 | **87.0%** |
| MCTS@10 | 86.0% |

**MATH-500** (competition-level math, N=16):

| Method | Accuracy |
|--------|:--------:|
| Pass@1 (baseline) | 40.0% |
| Majority / PRM Rerank / Weighted@16 | 44.0% |
| **MCTS@20** | **54.0%** |

**Key findings**: (1) MCTS provides a dramatic **+14pp improvement on hard problems** (MATH-500) while only modestly helping on easier ones (GSM8K), validating the test-time compute scaling hypothesis — harder problems benefit disproportionately from guided search with dense process supervision. (2) Diminishing returns appear beyond the optimal compute budget (MCTS@50 drops to 51% after peaking at 54% at MCTS@20), suggesting a difficulty-dependent optimal allocation of inference-time compute.

## Tech Stack

Python, PyTorch, Hugging Face Transformers, Unsloth, TRL (SFTTrainer), PEFT (LoRA), bitsandbytes (NF4), vLLM, Weights & Biases

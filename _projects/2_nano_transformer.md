---
layout: page
title: "Nano-Transformer: An End-to-End LLM Pretraining Stack from Scratch"
description: "A compact, fully inspectable transformer language model and training stack built from scratch in PyTorch"
importance: 1.5
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Nano-Transformer
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Nano-Transformer)

## Overview

Nano-Transformer is an educational, research-grade LLM codebase built entirely from scratch in PyTorch — a deliberate middle ground between toy single-file implementations and heavyweight production frameworks. It provides a **compact but genuinely end-to-end training stack**: byte-level BPE tokenization, a modern decoder-only transformer, distributed pretraining, and autoregressive inference with KV caching. Every component is written as explicit, inspectable code (no `transformers` dependency for the model), making it suitable for both experimentation and study, and it is backed by a **comprehensive test suite (117 passing tests)** covering model correctness, inference parity, tokenization, MoE routing, optimizers, and serialization.

## Architecture

**Core Model (`TransformerLM`)**: A modern decoder-only transformer incorporating architectural choices from recent frontier models:

- **Merged QKV projection** for the attention block
- **Grouped-Query Attention (GQA)** via a configurable `num_kv_heads`
- **RoPE positional embeddings** with optional linear and YaRN context-length scaling
- **QK-Norm** for training stability
- **Attention-logit and final-logit softcapping**
- **Zero-initialized residual branches**, optional **tied embeddings**, and a **multi-token prediction (MTP)** head
- **Runtime-updatable attention window** sizing

**Supporting blocks** — all implemented from scratch: `Embedding`, `RMSNorm`, `SwiGLU`, `ScaledDotProductAttention`, `MultiHeadSelfAttention`, and `TransformerBlock`.

**Default configuration**: `d_model=256`, 4 layers, 8 attention heads, context length 128, batch size 16 — small enough to train and iterate on quickly, while the code scales to larger configs.

## Attention & Inference

**Attention variants**: An SDPA fast path with a hand-written fallback implementation, **sliding-window attention**, **global prefix tokens**, and **document masking** so multiple documents can be packed into a single batch without cross-contamination.

**Inference engine** — built from scratch:

- **Preallocated KV cache** with separate prefill and incremental decode steps
- **Cache branching** for efficient multi-sample generation from a shared prefix
- Decoding strategies: **greedy, multinomial, top-k, and top-p (nucleus)** sampling

## Mixture of Experts (MoE)

An optional MoE layer with **vectorized token-choice routing**, including:

- **Shared expert** support alongside routed experts
- **Capacity control** with explicit dropped-token accounting
- **Auxiliary load-balancing loss** and **router z-loss**
- **Bias-based router balancing** for even expert utilization

## Training Pipeline

- **Document-aware batching** with EoS-prefixed tokenization and max-document-length truncation
- **Gradient accumulation** for large effective batch sizes
- **Staged schedules** that ramp context length, batch size, attention window, and MTP loss weight over the course of training
- **Checkpointing** with save/load, mid-run resume, and best-checkpoint tracking
- **Distributed training** via DDP, with TF32, autocast mixed precision, and optional `torch.compile`

## Optimizers

Multiple optimizers implemented from scratch with a unified interface:

- **AdamW** (from-scratch reference implementation)
- **Muon** optimizer
- **Hybrid Muon + AdamW** parameter grouping (Muon for hidden matrices, AdamW for embeddings/norms)
- **Cautious weight decay** and **LR-tied weight-decay scheduling**

## Tokenization

- **GPT-2-style byte-level BPE**, trained from scratch (`train_bpe.py`)
- **Fingerprinted token caches** that automatically invalidate when the tokenizer changes
- Special-token handling (e.g. end-of-sequence)
- Pre-trained tokenizer artifacts included for **TinyStories** and **OpenWebText**

## Datasets

Ships with pre-trained tokenizers and cached BPE artifacts for **TinyStories** (train/valid splits) and an **OpenWebText** sample, and accepts arbitrary custom text files or Hugging Face datasets for pretraining.

## Testing & Validation

A thorough test suite — **117 passed, 2 skipped** — validates the full stack:

- Model correctness and output snapshots
- Tokenizer / BPE round-trip behavior
- Inference parity and KV-cache correctness
- MoE routing and distributed statistics
- Optimizer update steps
- Checkpoint serialization and end-to-end script flows

## Tech Stack

Python (≥3.11), PyTorch (`torch.compile`, DDP, autocast, TF32), `uv` for packaging and reproducible locking, pytest. Model, tokenizer, optimizers, and inference are all implemented from scratch with no reliance on external LLM libraries.

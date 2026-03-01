---
layout: page
title: "Visual-CoT: Pixel-Grounded Reasoning with Multi-Modal Chain-of-Thought"
description: "Fine-tuned VLM generating interleaved reasoning traces with bounding box coordinates, reducing object hallucination"
importance: 6
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Visual-CoT
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Visual-CoT)

## Overview

Visual-CoT fine-tunes a Vision-Language Model to produce **spatially-grounded chain-of-thought reasoning traces** — explanations that interleave natural language deduction with precise bounding box coordinates anchoring each claim to specific image regions. The model articulates *what* it observes, *where* it observes it (via `<ref>object</ref><box>[x1, y1, x2, y2]</box>` annotations normalized to a 0–1000 coordinate space), and *how* it reaches conclusions. By training on 135K+ samples from the VisCOT dataset where **100% of training examples contain valid bounding boxes**, the system reduces object hallucination — every object mention must be backed by a verifiable spatial location. The framework uses **QLoRA** (rank 64, 7 target modules) on Qwen2.5-VL-7B-Instruct with a pre-tokenization strategy that sidesteps VLM multimodal collator issues, achieving a final training loss of ~0.62 over ~16,800 steps.

## Grounded Reasoning Format

The model's output interleaves reasoning text with structured spatial references:

```
First, I identify the <ref>red gear</ref><box>[100, 200, 300, 400]</box> in the mechanism.
Looking at how it connects to the <ref>blue lever</ref><box>[350, 180, 500, 250]</box>...
Therefore, when the gear rotates clockwise, the lever will move upward.
```

Bounding boxes are **generated autoregressively as text tokens** — there is no separate detection head. The model learns during fine-tuning to emit coordinate tokens as part of its language generation, leveraging Qwen2.5-VL's pretrained spatial understanding. All coordinates use **integers from 0 to 1000** (where (0,0) is top-left, (1000,1000) is bottom-right), reducing token count per coordinate (3–4 tokens vs. 5–6 for floats) and avoiding floating-point precision issues in text generation.

## Training Data Pipeline

**Primary Source: VisCOT Dataset** — 150,000+ samples with real bounding box annotations from `deepcs233/Visual-CoT` on HuggingFace. The conversion pipeline parses conversation turns, extracts bounding boxes via regex (handling both 0–1 float and 0–1000 integer formats with automatic normalization), and constructs the `<ref>/<box>` training format. Quality filtering (`filter_quality=True`) discards samples without valid bounding boxes, ensuring **100% grounding coverage** across training data.

**Secondary Source: ScienceQA + GPT-4o Distillation** — For image-containing ScienceQA samples, images are base64-encoded and sent to GPT-4o with a system prompt enforcing the `<ref>/<box>` format ("CRITICAL RULE: Whenever you mention a physical object... you MUST immediately follow it with its bounding box"). Rate-limited to 10 concurrent requests with exponential-backoff retries.

Final split: **135K training / 15K validation** (90/10 split). Data quality analysis tracks `<ref>` tag coverage, V-CoT `<box>` tag density, and average response lengths.

## Model Architecture

| Component | Specification |
|-----------|---------------|
| **Base VLM** | Qwen2.5-VL-7B-Instruct (4-bit NF4 quantization via Unsloth) |
| **LoRA Rank / Alpha** | 64 / 128 (alpha/r = 2.0) |
| **LoRA Targets** | All 7 linear layers: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **LoRA Dropout** | 0.05 |
| **Gradient Checkpointing** | Unsloth-optimized variant |

**Dual-path model loading**: Auto-detects Unsloth's `FastVisionModel` at import time; falls back to standard HuggingFace Transformers + PEFT + `BitsAndBytesConfig` (NF4, double quantization, float16 compute dtype) when Unsloth is unavailable. The model ID is automatically remapped from the Unsloth quantized variant to `Qwen/Qwen2.5-VL-7B-Instruct`.

## Pre-Tokenization Strategy

A key engineering contribution addresses VLM multimodal collator issues during training. The approach:

1. **Extracts the text-only tokenizer** from the VLM processor (via `tokenizer.tokenizer`, `tokenizer.text_tokenizer`, or fallback to `AutoTokenizer`)
2. **Converts multimodal messages to plain text** using Qwen ChatML format (`<|im_start|>`/`<|im_end|>` tokens), stripping image references
3. **Tokenizes with the text tokenizer only**, producing standard `input_ids`, `attention_mask`, and `labels`

This trades away pixel-level fine-tuning in exchange for training stability — the assumption is that Qwen2.5-VL's pretrained visual understanding is already strong enough, and fine-tuning only needs to teach the structured `<ref>/<box>` output format. Uses `DataCollatorForSeq2Seq` with dynamic padding rather than the VLM's multimodal collator.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Learning rate | `1e-4` with cosine decay |
| Warmup ratio | 3% of training |
| Epochs | 2 |
| Batch size | 4 per device × 4 gradient accumulation = **16 effective** |
| Weight decay | 0.01 |
| Max gradient norm | 0.3 |
| Max sequence length | 2,048 tokens |
| Optimizer | `adamw_8bit` (memory-efficient) |
| NEFTune noise alpha | 5 |
| Early stopping | Patience 3, monitoring `eval_loss` (δ > 0.001) |
| Precision | BF16 if supported, else FP16 |
| Logging | TensorBoard (every 50 steps) |

**NEFTune** (Jain et al., 2023) adds uniform random noise to the embedding layer during training, scaled by `alpha / sqrt(seq_length × hidden_dim)`. This regularization technique improves instruction-following quality and helps prevent the model from memorizing surface-level patterns.

## Hallucination Reduction Mechanism

The system addresses object hallucination through four interconnected mechanisms: (1) **Grounded training data** — 100% of samples contain valid bounding boxes, teaching the model that every object claim must be spatially verifiable; (2) **Structured output format** — the `<ref>/<box>` format forces the model to commit to specific spatial locations, making hallucination harder than generating unconstrained text; (3) **NEFTune regularization** — noise injection prevents memorization of surface patterns; (4) **Evaluation-time IoU verification** — predicted boxes are extracted and validated against ground truth.

## Evaluation Framework

Three metrics quantify grounding quality:

**Grounding IoU**: Standard Intersection-over-Union between predicted and ground-truth bounding boxes, with `1e-6` epsilon for numerical stability.

**IoU Success Rate**: Fraction of predicted boxes achieving IoU > 0.5 against their best-matching ground truth.

**Box Detection Rate**: Percentage of model responses containing at least one valid `<box>` annotation — measures the model's consistency in producing grounded outputs.

Batch evaluation iterates over a JSONL evaluation set, runs greedy inference (`do_sample=False`, `repetition_penalty=1.2`) on each sample, parses predicted boxes, and aggregates per-sample IoU scores.

## Results

| Metric | Value |
|--------|:-----:|
| Training samples | 135,000 |
| Validation samples | 15,000 |
| Samples with bounding boxes | **100%** |
| Training steps | ~16,800 |
| Final training loss | **~0.62** |

The Gradio demo provides **real-time streaming** visualization: a `TextIteratorStreamer` runs generation in a separate thread while the main thread continuously parses accumulated text for `<ref>/<box>` patterns, denormalizes coordinates to pixel space, draws green rectangles with labels via OpenCV, and yields updated images to the UI — bounding boxes appear on the image live as the model reasons.

## Tech Stack

Python, PyTorch (2.0+), Hugging Face Transformers (4.40+), TRL (SFTTrainer), PEFT (QLoRA), Unsloth (FastVisionModel), bitsandbytes (NF4), Qwen2.5-VL, OpenAI GPT-4o, Gradio, OpenCV, Datasets

---
layout: page
title: "Video-DPO: Temporal Alignment for Video Diffusion via Direct Preference Optimization"
description: "DPO for video diffusion models, aligning generation for temporal stability and motion smoothness"
importance: 5
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Video-DPO
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Video-DPO)

## Overview

Video-DPO adapts the Diffusion-DPO framework (Wallace et al., 2023) from image generation to **video generation**, targeting temporal consistency in AnimateDiff-based models. The core insight: temporal coherence can be framed as a preference learning problem — the model learns to prefer smoothly-transitioning videos over temporally jittery ones through synthetic preference pairs, without requiring a separate reward model. LoRA adapters are applied **exclusively to motion module attention layers**, preserving spatial generation quality while improving temporal coherence. A memory-optimized adapter-toggling scheme halves GPU memory requirements by eliminating the need for a separate reference model copy. On 47 evaluation samples, the method achieves **25.7% reduction in optical-flow warping error** and **18.3% reduction in frame flickering**.

## Diffusion-DPO for Video

The method extends DPO to the diffusion setting by defining an **implicit reward** as the denoising quality gap between the policy and a frozen reference model:

```
r(x) = ||ref_pred − noise||² − ||policy_pred − noise||²
```

The DPO loss maximizes the reward margin between winner (temporally consistent) and loser (jittery) videos:

```
L_DPO = −log σ( β · (r_w − r_l) )
```

where `β = 2500` (notably higher than typical LLM DPO betas of 0.1–0.5, reflecting the different reward scale in diffusion MSE space). A critical design choice: **identical noise vectors and timesteps** are shared between winner and loser samples within each training step to ensure a fair comparison — any reward difference is attributable purely to the latent quality, not random noise variation.

**Training operates entirely in VAE latent space** — videos are pre-encoded offline as `[C=4, F=16, H=64, W=64]` tensors at 1/8 spatial resolution, decoupling expensive pixel-space operations from the training loop. Each `.pt` file stores `(latents_w, latents_l, prompt_embeds)` for efficient DataLoader throughput.

## Preference Data Construction

**Winners** are standard AnimateDiff outputs with smooth temporal transitions. **Losers** are synthetically degraded with temporal jitter via two methods:

**Noise Injection (default, fast)**: Independent per-frame Gaussian noise `N(0, s²)` plus random per-channel color shifts `U(-s/4, s/4)` with `s = 0.15`. Each frame receives different perturbations, breaking temporal coherence while preserving per-frame visual quality.

**Img2Img Regeneration (higher quality)**: Each frame is independently regenerated through `StableDiffusionImg2ImgPipeline` with a **unique random seed per frame** — semantically coherent but temporally inconsistent because each frame's generation is stochastically independent.

Multi-prompt training (8 diverse prompts covering cinematic shots, drone footage, slow motion, timelapse, wildlife, etc.) ensures the temporal preference signal generalizes across content types.

## Architecture and LoRA Targeting

| Component | Specification |
|-----------|---------------|
| **SD Backbone** | epiCRealism (Stable Diffusion 1.5 fine-tune) |
| **Motion Adapter** | AnimateDiff v1.5.2 (`guoyww/animatediff-motion-adapter-v1-5-2`) |
| **LoRA Targets** | Motion module attention only: `to_q`, `to_k`, `to_v`, `to_out.0` |
| **LoRA Rank/Alpha** | 32 / 64 (A100), 16 / 32 (L4), 4 / 8 (T4) |

The LoRA targeting strategy is critical: by training **only temporal attention projections** within `motion_modules`, the base UNet's spatial generation weights remain frozen — the model learns better temporal coherence without degrading spatial fidelity. Target modules are identified via named module traversal with a regex fallback: `r".*motion_modules.*(to_q|to_k|to_v|to_out\.0)$"`.

## Memory-Optimized Reference Model

Two modes for computing the frozen reference model's predictions:

**Standard mode**: Deep-copies the full UNet before LoRA injection (~8GB additional VRAM). Reference and policy are separate model copies.

**Memory-optimized mode** (adapter toggling): No deep copy. The reference forward pass temporarily disables LoRA adapters:

```python
model.disable_adapter_layers()    # → Reference model
ref_pred = model(noisy, t, prompt_embeds)
model.enable_adapter_layers()     # → Policy model
policy_pred = model(noisy, t, prompt_embeds)
```

This saves **~50% GPU memory** at the cost of additional forward passes, enabling training on 16GB GPUs (T4).

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Optimizer | AdamW (`lr=1e-5`, `weight_decay=0.01`) |
| Batch size | 1 (with 4-step gradient accumulation → effective 4) |
| Mixed precision | fp16 via Accelerate |
| Max gradient norm | 1.0 |
| Noise scheduler | DDPM (1,000 diffusion timesteps) |
| Inference scheduler | DDIM (25 steps) |
| Checkpointing | Every 200 steps, LoRA-only saves via PEFT |

At inference, LoRA weights are merged into the base UNet via `PeftModel.merge_and_unload()` for zero-overhead generation.

## Evaluation: Optical Flow Warping Error

Two temporal consistency metrics, both computed over consecutive frame pairs:

**Warping Error (primary)**: Computes simplified Lucas-Kanade optical flow between frames `t` and `t+1` (Sobel gradients + regularized least squares), warps frame `t` forward via `F.grid_sample` with bilinear interpolation, and measures MSE against actual frame `t+1`. Lower warping error indicates the model produces frame transitions that are well-predicted by optical flow — i.e., smooth, physically plausible motion.

**Frame Difference**: Average absolute pixel difference between consecutive frames — a direct measure of flickering intensity.

## Results

| Metric | Base Model | DPO Model | Improvement |
|--------|:----------:|:---------:|:-----------:|
| **Warping Error** | 150.32 | **111.62** | **−25.7%** |
| **Frame Difference** | 7.20 | **5.88** | **−18.3%** |

Evaluated on 47 video samples generated with **identical seeds** for direct comparison — differences are attributable solely to the LoRA weights, not random variation. DPO loss converges from ~0.7 to near zero with consistent `reward_w > reward_l` separation throughout training.

## Tech Stack

Python, PyTorch (2.1+), Diffusers (AnimateDiffPipeline, DDPMScheduler, DDIMScheduler), PEFT (LoRA), Hugging Face Transformers, Accelerate, OpenCV, imageio, NumPy

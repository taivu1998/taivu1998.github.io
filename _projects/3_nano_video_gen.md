---
layout: page
title: "Nano-Video-Gen: Spacetime Diffusion Transformer with Rectified Flow Matching"
description: "A Diffusion Transformer video generator from scratch with 3D spacetime patch embeddings and Rectified Flow Matching"
importance: 3
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Nano-Sora
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Nano-Sora)

## Overview

Nano-Video-Gen is a research-grade, from-scratch implementation of a Sora-style video generation model that combines three frontier ideas in generative modeling: **Diffusion Transformers (DiT)**, **3D spacetime patch tokenization (tubelets)**, and **Rectified Flow Matching**. The model treats video as a unified 4D spacetime manifold — tokenized via Conv3D tubelets, processed through DiT blocks with AdaLN-Zero conditioning and Flash Attention, and trained under a velocity-prediction flow matching objective — enabling **10x faster sampling** than DDPM (50 ODE steps vs. 1,000 diffusion steps). The entire architecture is implemented from scratch in pure PyTorch with no dependency on external diffusion libraries.

## Architecture

**Generation Pipeline**:
```
Raw Video (B, 1, 16, 64, 64)
  → PatchEmbed3D (Conv3D tubelet tokenizer) → 512 spacetime tokens
  → + Learned Positional Embeddings
  → 8× DiTBlock (AdaLN-Zero + Flash Attention + MLP)
  → Final AdaLN + Linear projection
  → Velocity field patches (B, 512, 128)
  → Unpatchify → Predicted velocity (B, 1, 16, 64, 64)
```

### 3D Spacetime Patch Tokenization (Tubelets)

Following Sora's architecture, videos are tokenized as joint spatiotemporal patches via a `Conv3D` layer with `kernel_size = stride = (2, 8, 8)`. Each "tubelet" spans 2 temporal frames × 8 height × 8 width pixels, encoding 128 raw pixel values into a single token. A 16×64×64 video produces `(16/2) × (64/8) × (64/8)` = **512 spacetime tokens**, enabling unified spatiotemporal attention without separate spatial/temporal mechanisms. Higher-fidelity configs use (2, 4, 4) patches for **2,048 tokens** at the cost of quadratically more attention compute.

### DiT Blocks with AdaLN-Zero Conditioning

Each of the 8 transformer blocks implements the DiT architecture:

1. **Adaptive Layer Norm (AdaLN-Zero)**: Timestep embeddings (sinusoidal positional encoding → 2-layer MLP with SiLU) are projected to 6 per-block modulation parameters `(shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp)` via a **zero-initialized** linear layer — ensuring each block acts as an identity function at initialization for stable training.

2. **Flash Attention**: Uses PyTorch 2.0+'s `F.scaled_dot_product_attention`, which auto-dispatches to Flash Attention kernels for O(N) memory complexity — critical for the 2,048-token configurations.

3. **MLP**: GELU-activated (tanh approximation) with 4× expansion ratio (384 → 1,536 → 384).

4. **Final Output Head**: AdaLN modulation followed by a **zero-initialized** linear projection to patch dimension — the model initially predicts zero velocity, a known DiT stabilization technique.

**Model configurations** scale from ~12M to ~38M parameters across T4/L4/A100 GPU profiles, with adjustable depth (8–12 blocks), hidden size (384–512), heads (6–8), and patch granularity.

## Rectified Flow Matching

The training paradigm replaces standard DDPM noise prediction with **velocity prediction** under Rectified Flow (Liu et al., 2022):

**Objective**: `L = E[ ‖ v_θ(x_t, t) − (x₁ − x₀) ‖² ]` where `x₀ ~ N(0,I)` (noise), `x₁ ~ p_data` (real video), `t ~ U(0,1)`, and `x_t = t·x₁ + (1−t)·x₀` (linear interpolation along the "straight path").

The model learns to predict the velocity field `v = x₁ − x₀` (the direction from noise to data) rather than the noise itself. A key implementation detail: the model outputs velocity in **patch space** `(B, N, patch_vol)`, so the target `x₁ − x₀` is patchified before computing MSE loss, avoiding unnecessary unpatchification during training.

**Advantages over DDPM**: Linear noise schedule (no hand-tuned beta schedules), learns "straight" ODE trajectories enabling far fewer sampling steps, and a simple MSE loss with no reweighting.

## Training Infrastructure

- **Optimizer**: AdamW (lr=3e-4, weight_decay=0.01) with cosine annealing and linear warmup (from 0.1)
- **Mixed Precision (AMP)**: `torch.amp.GradScaler` + `autocast` for ~2× speedup on modern GPUs
- **Gradient Clipping**: Max norm 1.0
- **EMA (Exponential Moving Average)**: Decay 0.9999, with full state serialization — EMA weights are used for generation and saved separately in checkpoints
- **Checkpointing**: Full state persistence (model, optimizer, scheduler, EMA, best loss, epoch) with automatic training resumption and best-model tracking
- **Data Pipeline**: Moving MNIST (10K grayscale videos, 20 frames × 64×64) with automatic download, integrity verification, corruption recovery, normalization to [-1, 1], temporal cropping, and horizontal flip augmentation

## Sampling / Inference

Two ODE solvers integrate the learned velocity field from noise (t=0) to data (t=1):

**Euler Method** (1st order, 50 steps default): `x_{t+dt} = x_t + v_θ(x_t, t) · dt`

**Heun's Method** (2nd order, predictor-corrector): Evaluates velocity at both the current point and the Euler-predicted next point, averaging for significantly better accuracy at 2× compute cost per step — particularly effective with fewer steps.

**Visualization**: GIF/MP4/PNG strip outputs, plus a spacetime attention visualization that hooks into the last DiT block's attention layer, extracts weights for a center token, and reshapes to `(T_grid, H_grid, W_grid)` heatmaps showing which spacetime regions the model attends to.

## Results

- Generates coherent noise-to-video sequences capturing digit motion dynamics on Moving MNIST
- Converges within 48 hours on a single GPU
- 50-step ODE sampling (vs. 1,000 for traditional DDPM) — **10× faster generation**
- Comprehensive test suite (12 test classes) verifying patch round-tripping, zero-initialization, forward/backward passes, and flow matching loss computation

## Tech Stack

Python, PyTorch (2.1+), Flash Attention (`F.scaled_dot_product_attention`), TorchVision, NumPy, Matplotlib, PIL

---
layout: page
title: "GANime: Generating Anime Characters from Sketches with Deep Learning"
description: "Generative models for automating the colorization of anime sketches"
importance: 14
category: "Artificial Intelligence"
github: https://github.com/taivu1998/GANime
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/GANime)
[![](https://img.shields.io/badge/Paper-Read_paper-brightgreen?logo=affinity-publisher)](https://arxiv.org/abs/2508.09207)
[![](https://img.shields.io/badge/Poster-View_poster-orange?logo=styleshare)](https://taivu1998.github.io/assets/files/projects/GANime_Poster.pdf)

## Overview

Published as [arXiv:2508.09207](https://arxiv.org/abs/2508.09207) and developed as a Stanford CS230 project, GANime systematically benchmarks **four neural approaches** to anime sketch colorization — optimization-based Neural Style Transfer (NST), single-pass Fast NST, paired conditional GAN (Pix2Pix), and unpaired cycle-consistent GAN (CycleGAN) — on **17,769 sketch-color image pairs** at 256×256 resolution. The primary technical contribution is the addition of **Total Variation (TV) regularization** to the standard Pix2Pix objective, suppressing color-bleeding artifacts at region boundaries and yielding a **3.3% additional FID improvement** (227.9 → 220.5) over vanilla Pix2Pix. The TV-regularized Pix2Pix achieves an **FID of 220.5** and **SSIM of 0.756** — a **36.2% FID reduction** over the NST baseline (345.5) — while CycleGAN reaches FID=272.6 without requiring paired supervision. All architectures share a modular `Pix2Pix_Net` backbone providing U-Net generators and PatchGAN discriminators, with a custom `InstanceNormalization` Keras layer for CycleGAN's per-instance normalization. Implemented in TensorFlow 2.1 with `@tf.function` graph-mode training.

## Four Colorization Approaches

| Model | Approach | Supervision | FID | SSIM |
|-------|----------|:-----------:|:---:|:----:|
| Neural Style Transfer | Per-image VGG19 optimization | Per-image (1,000 steps) | 345.5 | 0.655 |
| Fast NST | Pre-trained TF Hub forward pass | None (pretrained) | — | — |
| Pix2Pix (C-GAN) | Conditional adversarial + L1 | Paired | 227.9 | 0.747 |
| **Pix2Pix + TV Loss** | Conditional adversarial + L1 + TV | **Paired** | **220.5** | **0.756** |
| CycleGAN | Cycle-consistent adversarial | Unpaired | 272.6 | 0.724 |

## U-Net Generator Architecture

The generator follows a modified U-Net with **8 encoder blocks** and **7 decoder blocks** + 1 final transposed convolution, accepting flexible-resolution 3-channel inputs. All convolutional layers use `tf.random_normal_initializer(0., 0.02)` with `use_bias=False`.

**Encoder (downsampling path)** — each block: `Conv2D(k=4, s=2, 'same')` → Normalization → `LeakyReLU`:

| Block | Filters | Output (256×256 input) | Normalization |
|:-----:|:-------:|:---------------------:|:-------------:|
| down1 | 64 | 128×128×64 | **None** |
| down2 | 128 | 64×64×128 | Yes |
| down3 | 256 | 32×32×256 | Yes |
| down4 | 512 | 16×16×512 | Yes |
| down5 | 512 | 8×8×512 | Yes |
| down6 | 512 | 4×4×512 | Yes |
| down7 | 512 | 2×2×512 | Yes |
| down8 | 512 | 1×1×512 | Yes (bottleneck) |

**Decoder (upsampling path)** — each block: `Conv2DTranspose(k=4, s=2, 'same')` → Normalization → [Dropout(0.5)] → `ReLU` → **Concatenate** with corresponding encoder skip connection:

| Block | Filters | After Skip Concat | Dropout |
|:-----:|:-------:|:-----------------:|:-------:|
| up1 | 512 | 2×2×1024 | **0.5** |
| up2 | 512 | 4×4×1024 | **0.5** |
| up3 | 512 | 8×8×1024 | **0.5** |
| up4 | 512 | 16×16×1024 | No |
| up5 | 256 | 32×32×512 | No |
| up6 | 128 | 64×64×256 | No |
| up7 | 64 | 128×128×128 | No |

**Final layer**: `Conv2DTranspose(3, k=4, s=2, activation='tanh')` → output `(256, 256, 3)` in `[−1, 1]`. The bottleneck output (down8) is excluded from skip connections, yielding 7 skip connections total that preserve fine-grained spatial details like hair strands, eye highlights, and clothing edges.

## 70×70 PatchGAN Discriminator

Rather than classifying the entire image, the discriminator produces a **30×30 grid of patch predictions**, each with a ~70×70 pixel receptive field — enforcing high-frequency structural accuracy. For Pix2Pix (conditional), input and target/generated images are **concatenated** along the channel dimension (6-channel input); for CycleGAN, only a single 3-channel image is input.

| Layer | Type | Filters | Kernel/Stride | Output |
|-------|------|:-------:|:------------:|:------:|
| down1 | Conv2D | 64 | k=4, s=2 | 128×128×64 |
| down2 | Conv2D + Norm | 128 | k=4, s=2 | 64×64×128 |
| down3 | Conv2D + Norm | 256 | k=4, s=2 | 32×32×256 |
| zero_pad + conv | ZeroPad + Conv2D + Norm | 512 | k=4, s=1 | 31×31×512 |
| zero_pad + last | ZeroPad + Conv2D | 1 | k=4, s=1 | **30×30×1** |

No sigmoid activation — raw logits used with `BinaryCrossentropy(from_logits=True)`.

## BatchNorm vs. InstanceNorm: Normalization Design

A critical architectural distinction: **Pix2Pix uses BatchNormalization** while **CycleGAN uses a custom InstanceNormalization** Keras layer that normalizes per-instance across spatial dimensions `[1, 2]` independently per sample and per channel:

```python
class InstanceNormalization(keras.layers.Layer):
    def build(self, input_shape):
        self.scale = self.add_weight('scale', shape=input_shape[-1:],
                                     initializer=tf.random_normal_initializer(1., 0.02))
        self.offset = self.add_weight('offset', shape=input_shape[-1:],
                                      initializer='zeros')
    def call(self, x):
        mean, variance = tf.nn.moments(x, axes=[1, 2], keepdims=True)
        return self.scale * (x - mean) * tf.math.rsqrt(variance + 1e-5) + self.offset
```

Learnable affine parameters: `scale ~ N(1.0, 0.02)`, `offset = 0`. This avoids the TensorFlow Addons dependency and provides full control over initialization — important because InstanceNorm prevents cross-sample style leakage in CycleGAN's unpaired training regime.

## Loss Functions

### Pix2Pix: Adversarial + L1 + TV Regularization

```
L_G = L_adversarial + 100 · L_L1 + 1e-4 · L_TV
```

| Component | Weight | Formula |
|-----------|:------:|---------|
| **Adversarial** | 1.0 | `BCE(ones_like(D(G(x))), D(G(x)))` — fool discriminator |
| **L1 Reconstruction** | 100.0 | `mean(\|target − G(x)\|)` — pixel-wise fidelity |
| **Total Variation** | 1e-4 | `mean(\|∇_x G\|) + mean(\|∇_y G\|)` — spatial smoothness |

**TV regularization** (the novel contribution) computes L1-norm finite differences between horizontally and vertically adjacent pixels, suppressing artifacts and color bleeding at region boundaries. Supports both **L1 (anisotropic)** and **L2 (isotropic)** variants via the `--norm-tv-loss` flag. The 3.3% FID improvement (227.9 → 220.5) validates its effectiveness for anime colorization where sharp color boundaries between hair, skin, and clothing are critical.

### CycleGAN: Adversarial + Cycle Consistency + Identity

```
L_G = L_adversarial(G) + 10 · L_cycle(X→Y→X) + 10 · L_cycle(Y→X→Y) + 5 · L_identity(G)
```

Cycle consistency loss enforces `F(G(x)) ≈ x` and `G(F(y)) ≈ y` (L1 distance), enabling unpaired training. Identity loss `\|G(y) − y\|` preserves color when the input is already in the target domain. Discriminator losses use a **0.5 scaling factor** (distinct from Pix2Pix's unscaled discriminators).

### Neural Style Transfer: Gram Matrix Optimization

```
L = (1e-2 / 5) · Σ MSE(Gram(style_out), Gram(style_target))
  + (1e4 / 1) · Σ MSE(content_out, content_target)
```

Style layers: `block{1-5}_conv1` (5 layers). Content layer: `block5_conv2`. Gram matrices computed via Einstein summation (`tf.linalg.einsum('bijc,bijd->bcd')`) normalized by spatial dimensions. Optimized via Adam (`lr=0.02`, `β₁=0.99`, `ε=0.1`) for 1,000 steps × 100 epochs per image.

## Dataset: 17,769 Anime Sketch-Color Pairs

| Split | Count | Ratio |
|-------|:-----:|:-----:|
| Training | 14,224 | 80% |
| Test | 3,545 | 20% |
| **Total** | **17,769** | 100% |

**Source**: Kaggle `ktaebum/anime-sketch-colorization-pair`, automated download via Kaggle API. Each source image is a horizontally concatenated color|sketch pair, split at the midpoint and resized to 256×256 via nearest-neighbor interpolation.

**Training augmentation** (via `@tf.function`-decorated `random_jitter()`): resize to **286×286** → random crop to 256×256 → random horizontal flip (50%). All pixels normalized to `[−1, 1]` via `(pixel / 127.5) − 1`.

## Training Configuration

| Parameter | Pix2Pix | CycleGAN | NST |
|-----------|:-------:|:--------:|:---:|
| Optimizer | Adam | Adam | Adam |
| Learning rate | 2e-4 | 2e-4 | 0.02 |
| β₁ / β₂ | 0.5 / 0.999 | 0.5 / 0.999 | 0.99 / 0.999 |
| Batch size | 32 | 8 | 1 |
| Epochs | 150 | 150 | 1,000 steps × 100 |
| Image size | 256×256 | 256×256 | max 512px |
| Checkpoint freq | Every 5 epochs | Every 5 epochs | — |
| Networks | 2 (G + D) | **4** (G_g, G_f, D_x, D_y) | 0 (VGG19 frozen) |

CycleGAN uses `tf.GradientTape(persistent=True)` since gradients for all four networks must be computed from the same forward pass. Both GAN models use `@tf.function`-decorated training steps for graph-mode execution with TensorBoard logging for all loss components.

## Evaluation

**FID (Frechet Inception Distance)**: InceptionV3 (`include_top=False, pooling='avg'`) extracts 2048-dimensional features; FID = `‖μ₁ − μ₂‖² + Tr(Σ₁ + Σ₂ − 2√(Σ₁Σ₂))` via `scipy.linalg.sqrtm`.

**SSIM**: `tf.image.ssim(max_val=255, filter_size=11, filter_sigma=1.5, k1=0.01, k2=0.03)`, averaged across all test pairs.

| Model | FID ↓ | SSIM ↑ | FID Reduction vs. NST |
|-------|:-----:|:------:|:---------------------:|
| Neural Style Transfer | 345.5 | 0.655 | baseline |
| CycleGAN | 272.6 | 0.724 | 21.1% |
| Pix2Pix | 227.9 | 0.747 | 34.0% |
| **Pix2Pix + TV Loss** | **220.5** | **0.756** | **36.2%** |

**Key findings**: (1) Paired supervision (Pix2Pix) dramatically outperforms unpaired approaches (CycleGAN) with a 55.7 FID gap. (2) TV regularization provides consistent improvement across both FID and SSIM. (3) SSIM plateaus around epoch 10 while FID continues improving until epoch 35, suggesting structural fidelity converges before perceptual quality. (4) PatchGAN effectively preserves fine details in hair, eyes, and clothing.

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/GANime_Demo.png" title="GANime Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/GANime_Poster.png" title="GANime Poster" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python (3.7+), TensorFlow (2.1), Keras, VGG19 (feature extraction), InceptionV3 (FID evaluation), TensorFlow Hub (Fast NST), SciPy (matrix square root), OpenCV, Kaggle API, TensorBoard, AWS EC2, Google Colab

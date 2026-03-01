---
layout: page
title: "How Not to Give a FLOP: Combining Regularization and Structured Pruning"
description: "A systematic study of regularization and network pruning techniques on ResNets"
importance: 17
category: "Artificial Intelligence"
github: https://github.com/taivu1998/ResNet-Regularization-Pruning
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/ResNet-Regularization-Pruning)
[![](https://img.shields.io/badge/Paper-Read_paper-brightgreen?logo=affinity-publisher)](https://arxiv.org/abs/2003.13593)

## Overview

Published as [arXiv:2003.13593](https://arxiv.org/abs/2003.13593), this project investigates the **synergy between data-level regularization and structured filter pruning** for efficient deep network inference. The central finding is that **Cutout + Soft Filter Pruning achieves Pareto dominance** over unpruned baselines — simultaneously **improving accuracy by up to +2.03%** while **reducing FLOPs by ~15%** across five ResNet depths (20/32/44/56/110) on CIFAR-10. The core insight is that regularization redistributes discriminative capacity more uniformly across filters, so that when the lowest-norm filters are zeroed by pruning, they are truly redundant rather than containing critical specialized features. The study evaluates a 5×6 experiment matrix (5 architectures × 6 configurations: baseline, Mixup-only, Cutout-only, pruning-only, Mixup+pruning, Cutout+pruning) totaling **30 experiments**, revealing that Cutout+Pruning consistently outperforms Mixup+Pruning by 0.93–1.53%, despite Mixup being the stronger standalone regularizer. Implemented in PyTorch with PyTorch Lightning and Weights & Biases experiment tracking.

## ResNet Architectures: CIFAR-Scale Family

All architectures follow He et al. (2015) with 3 stages, channel widths **16 → 32 → 64**, and spatial resolutions **32×32 → 16×16 → 8×8**. Each residual block uses two 3×3 convolutions with BatchNorm + ReLU and **Option A shortcut connections** (identity with zero-padding for dimension changes — no learnable projection parameters):

```python
self.shortcut = LambdaLayer(lambda x:
    F.pad(x[:, :, ::2, ::2], (0, 0, 0, 0, planes//4, planes//4), "constant", 0))
```

| Model | Blocks per Stage | Total Layers | Parameters | MFLOPs |
|-------|:----------------:|:------------:|:----------:|:------:|
| ResNet-20 | [3, 3, 3] | 20 | ~0.27M | 40.6 |
| ResNet-32 | [5, 5, 5] | 32 | ~0.46M | 68.9 |
| ResNet-44 | [7, 7, 7] | 44 | ~0.66M | 97.2 |
| ResNet-56 | [9, 9, 9] | 56 | ~0.85M | 125.5 |
| ResNet-110 | [18, 18, 18] | 110 | ~1.73M | 252.9 |

Initial layer: single 3×3 Conv2D (16 channels, no max pooling) → global average pooling → linear classifier. All weights initialized via **Kaiming Normal** (`init.kaiming_normal_`).

## Two Regularization Techniques

### Mixup (Zhang et al., 2018)

Applied during `training_step()` by creating convex combinations of input-label pairs within each minibatch:

```
x̃ = λ·xᵢ + (1−λ)·xⱼ,   λ ~ Beta(α, α),  α = 1.0
L_mixup = λ·L(pred, yₐ) + (1−λ)·L(pred, yᵦ)
```

Permutation index generated via `torch.randperm(batch_size)`. When `α=1.0`, lambda follows a uniform distribution over `[0, 1]`.

### Cutout (DeVries & Taylor, 2017)

Applied as a **torchvision transform** (after normalization, generating a different random mask per image access):

- `n_holes=1` square patch per image, `length=16` pixels per side
- Random center `(x, y)` sampled uniformly; patch extends beyond boundaries (clipped by `np.clip`)
- Zeros out normalized pixel values, forcing the network to recognize objects from partial observations

**Design distinction**: Cutout operates at the **input level** (spatial masking), while Mixup operates at the **label level** (inter-class blending). This difference proves critical for pruning compatibility.

## Soft Filter Pruning (He et al., 2018)

A **structured pruning** method operating at the filter level — entire convolutional filters are zeroed, not individual weights.

**Algorithm** (executed at end of each epoch):
1. **L2-norm ranking**: For each Conv2D layer, compute `‖Fᵢ‖₂ = √(Σ w²)` across all kernel dimensions per filter
2. **Selection**: Sort by L2-norm; select the bottom `(1 − pruning_rate)` fraction for zeroing
3. **Binary codebook masking**: Multiply filter weights element-wise by `{0, 1}` mask
4. **Soft reset**: Unlike hard pruning, zeroed filters remain in the architecture and **can be restored by backpropagation** in subsequent epochs

The "soft" aspect is key: the network continuously reallocates capacity, re-evaluating which filters to keep at every epoch — analogous to a **dynamic lottery ticket search**. With default `pruning_rate=0.9` (90% retained), ~15% FLOP reduction is achieved uniformly across architectures.

**Layer selection**: Pruning applies to every convolutional layer except downsample shortcuts and the final classifier. For CIFAR-scale ResNets using Option A (zero-padding) shortcuts, no skip lists are needed since shortcuts have no learnable parameters.

## Training Configuration

| Parameter | Default | Cutout Variant |
|-----------|:-------:|:-------------:|
| Optimizer | SGD (momentum=0.9, weight_decay=1e-4) | Same |
| Learning rate | 0.1 | 0.1 |
| LR schedule | MultiStepLR [100, 150], γ=0.1 | MultiStepLR [60, 120, 160], γ=0.2 |
| Batch size | 128 (train), 100 (test) | Same |
| Epochs | 200 | 200 |
| Augmentation | RandomCrop(32, pad=4) + HorizontalFlip | Same + Cutout(n=1, l=16) |
| Pruning frequency | Every epoch | Every epoch |
| Pruning rate | 0.9 (90% retained) | 0.9 |

## Results: 5×6 Experiment Matrix on CIFAR-10

| Method | ResNet-20 | ResNet-32 | ResNet-44 | ResNet-56 | ResNet-110 |
|--------|:---------:|:---------:|:---------:|:---------:|:----------:|
| **Baseline** | 91.63% | 92.11% | 92.54% | 92.49% | 92.58% |
| Mixup | 92.67% | 93.39% | 94.16% | 94.15% | 94.71% |
| Cutout | 91.81% | 93.48% | 93.60% | 93.86% | 93.95% |
| Pruning only | 91.47% | 91.40% | 92.23% | 91.42% | 91.88% |
| Mixup + Pruning | 91.94% | 93.06% | 93.12% | 93.80% | 93.04% |
| **Cutout + Pruning** | **92.87%** | **93.28%** | **94.12%** | **94.52%** | **94.57%** |

### Accuracy Deltas vs. Baseline

| Method | ResNet-20 | ResNet-32 | ResNet-44 | ResNet-56 | ResNet-110 |
|--------|:---------:|:---------:|:---------:|:---------:|:----------:|
| Mixup only | +1.04 | +1.28 | +1.62 | +1.66 | +2.13 |
| Cutout only | +0.18 | +1.37 | +1.06 | +1.37 | +1.37 |
| Pruning only | −0.16 | −0.71 | −0.31 | −1.07 | −0.70 |
| Mixup + Pruning | +0.31 | +0.95 | +0.58 | +1.31 | +0.46 |
| **Cutout + Pruning** | **+1.24** | **+1.17** | **+1.58** | **+2.03** | **+1.99** |

### Key Findings

1. **Pruning alone degrades accuracy** by 0.16–1.07% across all depths — removing filters without regularization loses critical features.

2. **Cutout + Pruning achieves Pareto dominance**: Better accuracy AND ~15% fewer FLOPs vs. unpruned baselines at every depth.

3. **Cutout > Mixup for pruning compatibility**: Cutout+Pruning outperforms Mixup+Pruning by 0.93–1.53% despite Mixup being the stronger standalone regularizer (+1.55% avg vs. +1.07% avg). This is because Cutout's spatial masking forces **filter-level redundancy** (each filter must be robust to missing input regions), while Mixup's inter-class blending spreads information across classes but not necessarily across filters.

4. **Benefits scale with depth**: Cutout+Pruning improvement grows from +1.24% (ResNet-20) to +2.03% (ResNet-56), suggesting deeper networks have more prunable redundancy when properly regularized.

5. **Near-free compression**: The accuracy gap between Cutout-only and Cutout+Pruning averages only 0.53%, meaning ~15% FLOP reduction comes nearly "for free."

## FLOP Reduction Analysis

Analytical FLOP computation models the per-layer reduction: for the first convolution per block (only output channels pruned), FLOPs scale by retention rate `r`; for the second convolution (both input and output pruned), FLOPs scale by `r²`.

| Pruning Rate | Filter Retention | Approx. FLOP Reduction |
|:------------:|:----------------:|:----------------------:|
| 0.9 | 90% | **~15%** |
| 0.8 | 80% | ~28% |
| 0.7 | 70% | ~40% |

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/FLOP_Demo1.png" title="FLOP Results Overview" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/FLOP_Demo2.jpg" title="FLOP Training Curves" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/FLOP_Demo3.jpg" title="FLOP Pruning Results" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python (3.7+), PyTorch, PyTorch Lightning, Weights & Biases (experiment tracking), TensorBoard, NumPy

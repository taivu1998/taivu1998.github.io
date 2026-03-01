---
layout: page
title: "Global Deforestation: Classifying Forest Loss Drivers from Satellite Imagery"
description: "A deep learning classification framework of deforestation drivers from multi-temporal Landsat imagery"
importance: 13
category: "Artificial Intelligence"
github: https://github.com/taivu1998/aicc-spr20-deforest-global
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/aicc-spr20-deforest-global)

## Overview

Developed under the **Stanford AI for Climate Change (AICC)** initiative, this system classifies the **drivers** of global deforestation — commodity agriculture, shifting cultivation, forestry, wildfire, and urbanization — from multi-temporal Landsat satellite imagery (2000–2018) at 15m/pixel resolution. Understanding *why* forests are lost (not just where or when) is essential for targeted policy interventions: commodity-driven deforestation requires supply-chain regulation, while wildfire demands fire management and shifting agriculture needs sustainable farming support. The system implements a complete pipeline from satellite image acquisition (Descartes Labs API with multi-sensor fallback across Landsat 8/7/5) through cloud-masked median compositing, 82-feature geospatial enrichment, and deep learning classification via **14 CNN backbone architectures**, an **LRCN temporal model** (CNN + LSTM), and a **FusionNet multimodal late fusion** architecture combining visual features with geographic coordinates, fire radiative power, population density, and forest loss metrics. Achieves **~80% classification accuracy** across 5 driver categories on a global test set.

## Five Deforestation Driver Categories

| Class | Definition | Training Distribution |
|-------|-----------|:--------------------:|
| **Commodity-Driven** | Permanent conversion to agriculture/mining | 18.7% |
| **Shifting Agriculture** | Small-scale rotational cultivation | 25.7% |
| **Forestry** | Large-scale timber harvesting (expected regrowth) | 34.2% |
| **Wildfire** | Natural or anthropogenic fire-driven loss | 16.5% |
| **Urbanization** | Settlement and infrastructure expansion | 4.9% |

Ground-truth labels from Curtis et al. (2018, *Science*); loss-year detection from Hansen Global Forest Change (Hansen et al., 2013, *Science*).

## Satellite Image Acquisition Pipeline

The `TileDownloader` creates 10km × 10km tiles (666 × 666 pixels at 15m) centered on deforestation coordinates via `dl.scenes.DLTile.from_latlon()`, with a **multi-sensor fallback chain**: Landsat 8 → Landsat 7 → Landsat 5 — ensuring coverage across the full 2000–2018 period despite sensor availability gaps.

**Band acquisition**: RGB + NIR + SWIR1 + SWIR2 + cloud/quality bands. **Cloud filtering** applies a three-stage pipeline: scene-level cloud fraction threshold (0.5), per-pixel cloud masking using cloud-mask AND bright-mask bands, and NDVI quality control for Landsat 7 (mean NDVI > 48,000). Clean pixels are composited via **masked median** of the top-5 lowest-cloud scenes into annual composites for temporal sequences.

**Forest loss polygon extraction**: Hansen GFC product is queried for loss-year masks (tree cover > 30% threshold), then OpenCV contour detection (`cv2.findContours`) extracts polygon shapes, filtered by minimum size (> 2 pixels), with areas normalized by `MAX_LOSS_AREA = 331,836.0`.

## 82 Auxiliary Geospatial Features

Beyond satellite imagery, each sample is enriched with structured geospatial data:

- **Fire metrics (21 features)**: Brightness, count, fire radiative power (FRP) at 1km and 10km scales with max/mean/sum aggregations
- **Forest loss metrics (14 features)**: Fire-associated loss, total loss, loss-year differences at multi-scale
- **Forest gain metrics (7 features)**: Gain at 10km scale with various aggregations
- **Land cover types (4 features)**: Deciduous broadleaf, evergreen broadleaf, mixed, needleleaf
- **Population metrics (21 features)**: Density in 2000/2015, population change, at multi-scale
- **Tree cover metrics (7 features)**: Cover percentage in year 2000 at various spatial scales
- **Temporal patterns (10 features)**: Loss-year difference features at 1km and 10km

All auxiliary features are Z-score normalized using training set statistics, with values below −1e30 imputed as 0 (following Curtis et al.).

## Model Architectures

### 14 CNN Backbones

DenseNet121/161/201, ResNet18/34/101/152, Inceptionv3/v4, ResNeXt101, NASNetA, MNASNet, SENet154, SEResNeXt101 — sourced from both TorchVision and Cadene's pretrained model zoo. **Multi-temporal channel expansion**: for temporal sequences, the first convolutional layer is expanded from 3 to `3 × 4 = 12` channels, with pretrained weights replicated across additional channels.

### LRCN — Long-term Recurrent Convolutional Network

Based on Donahue et al. (2015), processes temporal satellite image sequences:

```
Input: [B, C, S, H, W] → Reshape to [B×S, C, H, W]
  → Shared-weight CNN backbone (feature extraction)
  → Reshape to [B, S, num_features]
  → LSTM (hidden=128, 1 layer, batch_first=True)
  → Last hidden state → Linear classifier → 5 classes
```

Captures temporal dynamics of deforestation — distinguishing between permanent conversion (commodity) and cyclical patterns (shifting agriculture, forestry with regrowth).

### FusionNet — Multimodal Late Fusion

Combines CNN visual features with structured geospatial data:

```
CNN backbone → features → Linear(1024→128) → [128-dim]
  + Sinusoidal lat/lon encoding [20-dim] (Vaswani et al. positional encoding)
    OR one-hot region embedding [7-dim]
  + Polygon loss area [1-dim]
  + 82 auxiliary features [82-dim]
  → Concatenated → MLP(→128, ReLU, Dropout(0.2), →128, ReLU, Dropout(0.2), →5)
```

**Positional encoding** follows Vaswani et al. (2017): `sin(v / 10^(i/N))` and `cos(v / 10^(i/N))` for normalized lat/lon coordinates, producing 20-dimensional geographic embeddings. This enables the model to learn spatial patterns of deforestation drivers (e.g., commodity-driven deforestation clusters in South America and Southeast Asia).

### RegionModel — Per-Continent Ensemble

Routes samples to 7 continent-specific model instances (NA, LA, EU, AF, AS, SEA, OC), exploiting the strong geographic clustering of deforestation drivers.

### SeCo — Self-Supervised Pretraining

Seasonal Contrast (Manas et al., ICCV 2021) — ResNet-18/50 encoders pretrained on unlabeled satellite imagery using seasonal contrast learning, addressing limited labeled data in remote sensing. Four pretrained checkpoints (100K and 1M samples for each backbone).

### Baselines

**Random Forest** and **Logistic Regression** with grid search (n_estimators, max_depth, regularization), 5-fold cross-validation, and a **nearest-neighbor fallback** — when classifier confidence < 0.5, predict the label of the geographically closest training sample, exploiting spatial autocorrelation of deforestation drivers.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Optimizer | Adam (`lr=3e-5`, `weight_decay=1e-2`) |
| LR scheduler | ReduceLROnPlateau (patience=4, monitoring val accuracy) |
| Batch size | 10 (train), 1 (val/test) |
| Max epochs | 100 |
| Early stopping | Patience 25, monitoring val accuracy |
| Gradient clipping | 0.5 |
| Loss | Cross-entropy (optional class weighting inversely proportional to frequency) |
| Data parallel | `distributed_backend="dp"` |
| Augmentation | 7 presets; production uses **aggressive**: salt-and-pepper (0–10%), flips, scale, translate, rotation, shear, elastic deformation |

**Hyperparameter optimization**: Grid search via Launchpad (LR × weight decay × 20 samples), Bayesian optimization via NNI (TPE tuner, 50 max trials, 12 concurrent), and FusionNet-specific sweeps.

## Evaluation

- **Per-class precision, recall, F1** via `sklearn.classification_report`
- **Loss-area-weighted evaluation**: Metrics weighted by forest loss polygon area — prioritizing classification accuracy on large-scale deforestation events with greater environmental impact
- **Per-region breakdown**: Separate reports for each of 7 continental regions
- **Normalized confusion matrices**: Visualized as seaborn heatmaps

## Results

**~80% classification accuracy** across 5 deforestation driver categories on a global test set spanning all 7 continental regions. Per-region convergence epochs: OC=7, NA=7, EU=13, AS=14, SA=19, AF=25 — reflecting varying regional complexity and data availability.

## Tech Stack

Python (3.7+), PyTorch, PyTorch Lightning (0.9), Descartes Labs API (satellite imagery), scikit-learn (baselines, metrics), pretrainedmodels (Cadene CNN zoo), imgaug (7 augmentation presets), NNI (Bayesian optimization), OpenCV (contour detection), SymPy, TensorBoard, CircleCI, Travis CI

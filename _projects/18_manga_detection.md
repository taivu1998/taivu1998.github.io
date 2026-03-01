---
layout: page
title: "MangaNet: Object Detection for Manga with Deep Neural Networks"
description: "Advanced object detection model architectures for the manga domain"
importance: 18
category: "Artificial Intelligence"
github: https://github.com/taivu1998/MangaObjectDetection
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/MangaObjectDetection)
[![](https://img.shields.io/badge/Paper-Read_paper-brightgreen?logo=affinity-publisher)](https://taivu1998.github.io/assets/files/projects/MangaNet_Paper.pdf)
[![](https://img.shields.io/badge/Slides-View_slides-blueviolet?logo=styleshare)](https://taivu1998.github.io/assets/files/projects/MangaNet_Slides.pdf)

## Overview

Developed as a Stanford CS 231N project, MangaNet conducts the first controlled comparison of **three fundamentally different detection paradigms** — two-stage Faster R-CNN, anchor-based single-stage RetinaNet, and grid-based single-stage YOLOv3 — on the **Manga109 benchmark** (109 titles, 21,142 annotated pages, 500,000+ bounding boxes) for detecting 4 manga-specific object classes: **body**, **face**, **frame**, and **text**. Faster R-CNN with ResNet-50 + Feature Pyramid Network achieves a **state-of-the-art COCO-standard mAP@[0.5:0.95] of 71.0**, surpassing the prior SSD300-fork baseline (Ogawa et al., 2018). Beyond the detection benchmark, the project explores **Neural Style Transfer as domain augmentation** — applying artistic style transfer to manga pages and fine-tuning the detector on stylistically altered images to bridge the visual gap across the 109 manga titles' diverse artistic styles. All models use ImageNet/COCO-pretrained backbones with full fine-tuning, custom `imgaug`-based augmentation pipelines with synchronized bounding box transformation, and COCO-standard evaluation via `pycocotools`.

## Four Detection Targets

| Class | Label | Detection Challenges |
|-------|:-----:|---------------------|
| **Body** | 1 | High scale variance, frequent occlusion by panel borders |
| **Face** | 2 | Small objects, extreme stylistic variation across 109 titles |
| **Frame** | 3 | Large near-rectangular objects, densely packed on each page |
| **Text** | 4 | Variable size, irregular shapes, frequent overlap with frames |

## Three Detection Architectures

### Faster R-CNN (Two-Stage) — Best Performer

**Backbone**: ResNet-50 + FPN (Feature Pyramid Network producing P2–P5 at 256 channels each). **Stage 1**: Region Proposal Network with 15 anchors per spatial location (5 scales × 3 aspect ratios, scales {32, 64, 128, 256, 512}px). **Stage 2**: RoI Align (7×7 pooling) → two FC layers (1024 units) → `FastRCNNPredictor` (5 classes: 4 object + 1 background). Loss: cross-entropy (classification) + Smooth L1 (box regression).

Initialized from **full COCO-pretrained weights** (not just backbone), then the classification head is replaced for 5-class output — all parameters remain trainable for full fine-tuning:

```python
model = torchvision.models.detection.fasterrcnn_resnet50_fpn(pretrained=True)
in_features = model.roi_heads.box_predictor.cls_score.in_features
model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes=5)
```

### RetinaNet (Single-Stage, Focal Loss)

**Backbone**: ResNet-50 + FPN (P3–P7, strides 8–128). **Classification subnet**: 4 Conv layers (256 channels, 3×3, ReLU) → K×A outputs. **Box regression subnet**: 4 Conv layers → 4×A outputs. **Focal Loss**: `FL(pₜ) = −αₜ(1−pₜ)^γ · log(pₜ)` with γ=2.0, α=0.25 to handle the extreme foreground-background class imbalance in dense manga pages. Initialized from **ImageNet-pretrained backbone only** — FPN and detection heads trained from scratch.

### YOLOv3 (Single-Stage, Grid-Based)

**Backbone**: Darknet-53 (53 convolutional layers with residual connections). **Multi-scale detection**: 3 heads at 13×13 (large), 26×26 (medium), 52×52 (small) grids, 3 anchors per scale (9 total). **Input**: Fixed 416×416 pixels. Per-cell output: `(bx, by, bw, bh, objectness, 4_class_probs)` × 3 anchors. Pretrained from `darknet53.conv.74` (first 74 layers on ImageNet), detection heads trained from scratch.

## Dataset: Manga109

| Property | Value |
|----------|:-----:|
| Source | Aizawa Yamasaki Matsui Lab, University of Tokyo |
| Titles | 109 manga series |
| Pages | 21,142 annotated |
| Annotations | 500,000+ bounding boxes (body, face, frame, text) |
| Resolution | ~1654 × 1170 pixels per page |
| Format | XML parsed via `manga109api` → Pandas DataFrame → pickle |

**Data split** (stratified via `sklearn.train_test_split`, `random_state=0`): 80% train / 10% validation / 10% test. Pages with zero annotations removed ("condensed" dataset). Degenerate bounding boxes (`xmin ≥ xmax` or `ymin ≥ ymax`) discarded.

**YOLO format conversion**: Absolute pixel coordinates `[xmin, ymin, xmax, ymax]` → normalized center coordinates `[cx/W, cy/H, w/W, h/H]` with per-image `.txt` label files.

## Data Augmentation Pipeline

Custom `imgaug`-based pipeline ensuring **synchronized transformation** of images and bounding boxes:

```python
class ImgAug(object):
    def __call__(self, image, target):
        bbs = BoundingBoxesOnImage(bbox_list, shape=image.shape)
        image, bbs = self.augmentations(image=image, bounding_boxes=bbs)
        bbs = bbs.clip_out_of_image()  # Clip boxes that went out of bounds
```

**Training augmentation** (DefaultAug): Sharpen (0.0–0.1) → Affine (translate ±10%, scale 0.8–1.5) → Brightness (−60 to +40) → Hue shift (±10) → Horizontal flip (50%) → **PadSquare** (center-pad to 1:1 aspect ratio) → ToTensor.

**Validation/Test**: PadSquare → ToTensor only (no augmentation).

**StrongAug** (available for ablation): Adds Dropout (0–1%), rotation (±10°), wider hue range (±20).

## Training Configuration

| Parameter | Faster R-CNN | RetinaNet | YOLOv3 |
|-----------|:----------:|:---------:|:------:|
| Optimizer | Adam | Adam | SGD |
| Learning rate | 1e-4 | 1e-4 | Config-defined |
| Batch size | 4 | 4 | 8 |
| Epochs | 10 | 15 | ~8+ |
| Input size | Variable (FPN) | Variable (FPN) | 416×416 |
| Pretrained | Full COCO model | ImageNet backbone | darknet53.conv.74 |
| Augmentation | DefaultAug (imgaug) | DefaultAug (imgaug) | Library defaults |

**Checkpoint management**: Per-epoch full state saves + separate best-model checkpoint tracking `{epoch, model_state_dict, optimizer_state_dict, mAP}`, updated only when validation mAP improves. Supports resumable training from either best or most recent checkpoint.

## Neural Style Transfer Domain Augmentation

A novel experimental approach to bridge the visual gap across the 109 manga titles' diverse artistic styles:

1. **Style transfer**: Apply NST using a 21-style pretrained network (PyTorch-Style-Transfer) to generate stylistically altered versions of all manga pages (content size 1024px)
2. **Two-stage fine-tuning**: Start from a Faster R-CNN already trained on original manga data → fine-tune on NST-augmented images with SGD (`lr=0.01`, 10× higher than original) and batch size 8
3. **Coordinate alignment**: NST images resized to 1654×1170 to preserve annotation coordinate mappings

This explores whether artistic style transfer can serve as a domain augmentation strategy, making the detector more robust to the extreme visual diversity across manga series.

## Evaluation

**Primary metric**: COCO-standard mAP@[0.5:0.95] — averaged over 10 IoU thresholds (0.50, 0.55, ..., 0.95), the most stringent standard metric. Evaluated via `pycocotools` COCO API.

| Model | mAP@[0.5:0.95] |
|-------|:--------------:|
| SSD300-fork (Ogawa et al. 2018, prior SOTA) | < 71.0 |
| **Faster R-CNN (ResNet-50 + FPN)** | **71.0** |
| RetinaNet (ResNet-50 + FPN) | Competitive |
| YOLOv3 (Darknet-53) | Competitive |

**Why Faster R-CNN prevails**: The two-stage architecture's explicit region proposal mechanism excels for manga because: (1) the RPN generates high-quality proposals for densely overlapping body/face/frame/text regions, (2) FPN with multi-scale anchors (32–512px) handles the extreme range from tiny faces to full-page frames, and (3) full COCO model pretraining provides better initialization for detection-specific components (RPN, RoI heads) compared to backbone-only pretraining.

**YOLOv3 inference**: Confidence threshold 0.5, NMS IoU threshold 0.4, with box rescaling from 416×416 back to original dimensions and color-coded visualization per class.

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/MangaNet_Demo.jpg" title="Manga Object Detection Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python (3.7+), PyTorch, TorchVision (Faster R-CNN, RetinaNet), PyTorch-YOLOv3 (eriklindernoren), pycocotools (COCO evaluation), manga109api (annotation parsing), imgaug (augmentation with bbox sync), Pandas, NumPy, Matplotlib, Google Colab

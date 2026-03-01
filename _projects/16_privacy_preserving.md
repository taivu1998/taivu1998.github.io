---
layout: page
title: "DeepAniGNet: Privacy-Preserving Recommendation via Graph Neural Networks"
description: "A novel graph-based recommender system using BERT-powered embeddings and graph neutral networks to deliver personalized, privacy-preserving recommendations"
importance: 16
category: "Artificial Intelligence"
github: https://github.com/taivu1998/AnimeULike
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/AnimeULike)
[![](https://img.shields.io/badge/Paper-Read_paper-brightgreen?logo=affinity-publisher)](https://arxiv.org/abs/2508.14905)

## Overview

Published as [arXiv:2508.14905](https://arxiv.org/abs/2508.14905) ("Privacy Preserving Inference of Personalized Content for Out of Matrix Users"), DeepAniGNet is a **three-module hybrid recommendation system** that addresses the cold-start problem while preserving user privacy through aggregate content representations. The system combines: (1) a **BERT-based content encoder** (custom `bert-anime2vec` pretrained on anime synopses + reviews) producing 774-dimensional item embeddings, (2) a **GINEConv graph neural network** over a 10,000-node item-item recommendation graph with edge features, and (3) a **DropoutGNet scoring network** with stochastic masking (p=0.5) of Weighted Matrix Factorization (WMF) latent factors — simulating cold-start conditions during training so the model learns to score using content features alone. At inference, cold-start users are represented by a **content basket** — the masked average of BERT encodings of up to 10 watched items — transmitted instead of raw preference histories, providing privacy through aggregation. Evaluated on the custom **AnimeULike dataset** (10,000 anime, 13,000 users scraped from MyAnimeList) and the standard CiteULike benchmark, achieving state-of-the-art cold-start Recall@100.

## Three-Module Architecture

### Module 1: TransformerNet (Content Encoder)

Custom `bert-anime2vec` model fine-tuned on anime text. For each anime, concatenates synopsis + reviews, tokenizes with BERT tokenizer (`max_length=512, padding='max_length', truncation=True`), and extracts the `[CLS]` token embedding from `last_hidden_state[:, 0, :]` with per-sample z-score normalization. Concatenated with 6 MinMaxScaler-normalized scalar features (rating, rank, popularity, members, favorites) → **774-dimensional** item embedding.

**User encoding**: Randomly samples up to `max_shows_per_user=10` items from the user's watch history, BERT-encodes each, and computes **masked averaging** across the subset → single 774-dim user content vector. This averaged representation does not reveal individual items — providing privacy through aggregation.

**Selective fine-tuning**: Only the **last transformer layer** (layer 5 of DistilBERT) is unfrozen; all earlier layers remain frozen to prevent catastrophic forgetting.

### Module 2: GINEConv Graph Network

Builds an item-item graph from MyAnimeList user-generated recommendations ("if you liked X, try Y" pairs with helpfulness counts).

**GINEConv variant** (primary — when edge attributes available):

```
Edge features [num_edges, feat_dim] → Linear(feat_dim → node_dim) → Edge embeddings
Node features [10000, feat_dim] + Edge embeddings → GINEConv(
    MLP: Linear(feat_dim→96) → Tanh → Linear(96→64) → Tanh → Linear(64→32) → Tanh
) → node_reprs [10000, 32] → BatchNorm (per-feature z-score)
```

**GCNConv fallback** (3-layer): `GCNConv(feat→96) → Tanh → GCNConv(96→64) → Tanh → GCNConv(64→32) → Tanh`.

**Batch-local subgraph extraction**: `mask_edge_inds()` selects only edges where both endpoints are in the current batch of item indices, creating efficient batch-local subgraphs via boolean mask intersection.

Node features support multiple modalities: TF-IDF (2000-dim), BERT encodings (768-dim), or one-hot (10,000-dim). Edge features similarly support TF-IDF or BERT representations of recommendation text.

### Module 3: DropoutGNet (Scoring Network)

```
Inputs: u [B, 200] (WMF user), v [B, 200] (WMF item),
        u_phi [B, 774] (content), v_phi [B, 774+32] (content + GNN)

Stochastic masking (training): u = Bernoulli(0.5) · u,  v = Bernoulli(0.5) · v

Concatenate: phi_u = [u; u_phi] → [B, 974]
             phi_v = [v; v_phi; gnn_feats] → [B, 1006]

Hidden: Linear(974→500) → BatchNorm → Tanh  (user branch)
        Linear(1006→500) → BatchNorm → Tanh (item branch)

Project: f_u = Linear(500→10),  f_v = Linear(500→10)

Score: R̂ = f_u^T · f_v  (batch matrix multiply)
Loss: MSE(R̂, u^T v)  (WMF ground truth)
```

All linear layers initialized with `N(0, 0.01)` weights and zero biases. The **stochastic dropout** (p=0.5 for both user and item factors) is the key training mechanism: by randomly zeroing WMF factors, the model is forced to learn scoring from content features alone — enabling cold-start inference by setting WMF factors to zero.

## Privacy-Preserving Inference

The privacy mechanism operates through **content basket aggregation**:

1. **Client-side**: User samples up to 10 items from their watch history, computes BERT encodings locally, and transmits only the **masked average embedding** — a single 774-dim vector that does not reveal individual items watched
2. **Server-side**: At cold-start inference, WMF factors are set to zero (`v = np.zeros_like(v)`), and the model scores using only the content basket embedding + GNN item representations
3. **Training simulation**: The `eip`/`eup` (eval item/user drop probability) parameters control masking at evaluation time — when `eup=0.0`, user WMF factors are completely zeroed, simulating full privacy-preserving inference

## Dataset: AnimeULike

**Web scraping pipeline** (via `urllib` + `BeautifulSoup` with `multiprocessing.Pool`):

| Data Source | Scale | Fields |
|-------------|:-----:|--------|
| MAL anime pages | 10,000 titles | Synopsis, score, rank, popularity, members, favorites |
| MAL reviews | 50 pages/anime | Full review text (concatenated with synopsis) |
| MAL recommendations | User-generated pairs | (show1, show2, helpfulness, recommendation text) |
| MAL user profiles | ~13,000 users | Per-user anime ratings |

**Data split** (`random_state=0`): ~9,915 train / 50 validation / 35 test anime titles. Train items: 8,000 (with index mapping). WMF pre-computed at rank=200, regularization=1, α=10, 10 iterations, with z-score standardization and clipping to `[−5, 5]`.

## Training Configuration

| Parameter | Value |
|-----------|:-----:|
| Effective batch size | 100 (batch × accumulation) |
| Optimizer | Adam (`lr=1e-4`) or SGD (`lr=0.005`) |
| LR scheduling | Exponential decay (rate 0.9–1.0) |
| Epochs | 250 (anime), 5 (CiteULike pretrain) |
| WMF rank | 200 |
| Projection latent dim | 10 |
| Hidden dims | [500] |
| Dropout (user/item) | 0.5 / 0.5 |
| Activation | Tanh + BatchNorm |
| BERT max_length | 512 tokens |
| Max shows per user | 10 |
| Train samples | 50K positive + 50K negative |
| DataParallel | Multi-GPU |

**Evaluation-time caching**: Both TransformerNet (`u_phi_cache`/`v_phi_cache`) and DropoutGNet (`f_u_cache`/`f_v_cache`) maintain embedding caches. A `UserAnimeCacheID` "perimeter" indexing strategy processes all items for user 0, then only the first item for subsequent users, ensuring full user×item coverage with minimal redundant computation.

## Evaluation

**Metrics**: Item Recall@100 (fraction of relevant items in top-100 per user) and User Recall@100 (fraction of preferring users who receive the item in top-100). Cold-start evaluation zeros out item WMF factors and reconstructs `R̂ = U_hat · V_hat^T` from cached embeddings.

The system achieves **state-of-the-art cold-start Recall@100** on CiteULike and outperforms both WMF baseline and DropoutNet on AnimeULike. The content basket approach enables competitive cold-start performance without exposing individual viewing history.

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/DeepNaniNet_Demo.png" title="Privacy Preserving Inference Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python (3.8+), PyTorch (1.8.1), PyTorch Geometric (1.7.0 — GINEConv, GCNConv), HuggingFace Transformers (4.5.1 — BERT, DistilBERT), scikit-learn (TF-IDF, MinMaxScaler), Pandas, NumPy, SciPy, BeautifulSoup (web scraping), Matplotlib, NetworkX, Google Colab

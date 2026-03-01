---
layout: page
title: "ConnAIsseur: Cross-Domain Recipe Recommendation via BERT Embedding Transfer"
description: "A full-stack AI recipe platform using domain-adaptive BERT pre-training, cross-domain semantic alignment from restaurant reviews to recipes, and KNN retrieval"
importance: 5
category: "Web & App Development"
github: https://github.com/taivu1998/ConnAIsseur
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/ConnAIsseur)

## Overview

ConnAIsseur is a full-stack AI-driven recipe recommendation system whose core innovation is **cross-domain semantic alignment**: rather than requiring users to rate recipes directly (cold-start problem), the system infers culinary preferences from **restaurant selections**. Restaurant reviews and recipe descriptions are mapped into a **shared 768-dimensional BERT embedding space**, where the centroid of a user's selected restaurant embeddings becomes their "latent taste profile" — enabling preference transfer from dining affinities to recipe suggestions via **KNN retrieval with cosine similarity on KD-trees**. The NLP pipeline combines **domain-adaptive DistilBERT pre-training** (Masked Language Modeling on Yelp reviews), **multi-strategy keyword extraction** (KeyBERT + YAKE + RAKE ensemble), and a Yelp web scraping pipeline with BeautifulSoup4. The full-stack application pairs a **React SPA** (Material-UI, React Router v6, token-based auth) with a **Django REST Framework** backend (4 models, 15+ API endpoints, SearchFilter full-text search) deployed on **AWS EC2 with Nginx reverse proxy and HTTPS/SSL**.

## System Architecture

```
[Yelp Web Scraper] → [NLP Pipeline: BERT Pre-training + Keyword Extraction + Embeddings]
                                        ↓
                          [Pre-computed 768-dim Embeddings in CSV]
                                        ↓
[React SPA] ←──REST API──→ [Django REST Framework] ←→ [SQLite Database]
                                        ↓
                          [KNN Recommendation Engine (scikit-learn KD-tree)]
```

The system operates in two phases: (1) **offline** — data scraping, domain-adaptive BERT pre-training, embedding computation, and database population; (2) **online** — user profile construction from restaurant selections, real-time KNN-based recipe retrieval, and recipe search/browse.

## NLP Pipeline: Domain-Adaptive Pre-training

### DistilBERT Masked Language Modeling

Domain-adaptive pre-training fine-tunes `distilbert-base-uncased` (6 transformer layers, 12 attention heads, 768 hidden dim, ~66M parameters) on Yelp review text via **Masked Language Modeling** — 15% of tokens randomly masked, model learns to predict them from context. This adapts the general-purpose language model to culinary domain vocabulary and semantics (e.g., "umami", "sous vide", "al dente") before embedding extraction.

| Parameter | Value |
|-----------|:-----:|
| Base model | `distilbert-base-uncased` |
| Task | MLM (15% masking probability) |
| Optimizer | AdamW |
| Learning rate | 1e-4 |
| Weight decay | 0.01 |
| Epochs | 10 |
| Block size | 128 tokens |
| Data split | 90% train / 10% validation |
| Evaluation | Perplexity (`exp(eval_loss)`) per epoch |
| Best model selection | `load_best_model_at_end=True` |

### Text Embedding Generation (Three Strategies)

| Strategy | Model | Method | Dimensions |
|----------|-------|--------|:----------:|
| **Primary** | `textattack/bert-base-uncased-yelp-polarity` | `[CLS]` token from last hidden layer | 768 |
| Alternative | `distilbert-base-nli-mean-tokens` | Mean pooling (Sentence-BERT) | 768 |
| Fallback | GloVe-wiki-gigaword-300 | Mean of word vectors | 300 |

The production system uses a BERT model fine-tuned on Yelp polarity classification, extracting the `[CLS]` token representation (`outputs.last_hidden_state[:, 0, :]`) as a 768-dimensional embedding for both restaurant reviews and recipe descriptions — projecting them into a shared semantic space.

### Multi-Strategy Keyword Extraction Ensemble

Three complementary approaches capture different facets of keyword relevance:

| Method | Library | Config | Approach |
|--------|---------|--------|----------|
| **KeyBERT** | keybert | 3-gram, max-sum diversity, top 20 | Contextual (BERT cosine similarity) |
| **YAKE** | yake | 3-gram, dedup threshold 0.9, top 20 | Statistical (TF, position, co-occurrence) |
| **RAKE** | rake_nltk | Default | Rule-based (phrase frequency/degree) |

## Cross-Domain Recommendation Engine

### Latent Taste Profile Construction

When a user selects restaurants on the Preference page:

1. **Retrieve** 768-dim `review_embedding` for each selected restaurant from the database
2. **Compute centroid**: `profile_embedding = mean(restaurant_embeddings)` — the average embedding becomes the user's latent taste profile
3. If food preference embeddings exist, the final profile averages both restaurant and food preference centroids

### KNN Retrieval with Cosine-via-Euclidean

```python
def knn(point, data, n_neighbors, metric="cosine"):
    # L2-normalize for cosine: ||a-b||² = 2(1 - cos(a,b)) on unit sphere
    point = point / np.linalg.norm(point)
    data = data / np.linalg.norm(data, axis=1, keepdims=True)
    model = NearestNeighbors(n_neighbors=n_neighbors, algorithm='kd_tree', metric='euclidean')
    model.fit(data)
    return model.kneighbors(np.expand_dims(point, 0), n_neighbors, return_distance=False)
```

Cosine similarity is implemented by **L2-normalizing** both query and candidates, then using Euclidean distance on the unit hypersphere. This is mathematically equivalent (`‖a−b‖² = 2(1−cos(a,b))` for unit vectors) and enables scikit-learn's KD-tree algorithm (which doesn't natively support cosine distance).

**Stochastic candidate sampling**: Rather than searching the entire recipe database, the system randomly samples `NUM_RANDOM_RECIPES=100` candidates and retrieves the top `NUM_RECIPES_RECOMMEND=10` — trading recall for sub-second latency, suitable for real-time web serving.

## Web Application

### React SPA Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 17.0.2 (class components) |
| Routing | React Router DOM v6 (HashRouter) |
| Styling | Material-UI v5.3.1 + Emotion + Bootstrap 4.6 |
| HTTP | Axios 0.25.0 with token-based auth headers |
| Layout | react-horizontal-scrolling-menu (recipe carousels) |

**Component hierarchy**: `App.js` (global auth state via `this.state` + `localStorage` persistence) → `LoginPage` | `NavBar` + `HomePage` (saved + recommended carousels) | `PreferencePage` (restaurant search + selection) | `RecipePage` (detail view) | `SearchPage` (results grid) | `ProfilePage`.

### Django REST Framework Backend

**4 Django models**:

| Model | Key Fields |
|-------|-----------|
| `Recipe` | title, duration, ingredients, instructions, keywords, keyword_embedding, text_embedding (768-dim) |
| `Restaurant` | title, address, description, link, keywords, keyword_embedding, review_embedding (768-dim) |
| `Profile` | user (OneToOne→User), bio, dietary, food_prefs, restaurants, recipes, profile_embedding (768-dim) |
| `FoodImage` | title, description, link |

**15+ REST API endpoints** via DRF's `DefaultRouter`:

| Category | Endpoints | Key Features |
|----------|-----------|-------------|
| **Recipes** | list, detail, recommend, add, remove, get_recipe | SearchFilter on title/instructions/keywords |
| **Restaurants** | list, search, add, remove, get_restaurant | SearchFilter on title/address/description/keywords |
| **Profiles** | get_profile, update_profile, update_preferences | Recompute profile embedding on preference change |
| **Auth** | login, register, logout | Token authentication, password validation |

Dynamic serializer selection per action (`get_serializer_class()`) with separate list vs. detail serializers — list views exclude embedding fields for bandwidth efficiency.

## Yelp Web Scraping Pipeline

BeautifulSoup4-based scraper targeting Yelp restaurant pages:

- **Review text** extraction via CSS class targeting (`raw__09f24__T4Ezm`)
- **Metadata**: restaurant title, category tags (parsed from `/c` href anchors), star ratings
- **POS tagging** via `nltk.pos_tag()` to categorize extracted keywords by part of speech (NN, JJ, etc.)
- **Multiprocessing** with configurable chunk sizes for parallel scraping
- **Progress tracking** via text files for resumable execution across 150+ restaurants

## Deployment (AWS EC2)

| Component | Specification |
|-----------|:------------:|
| Cloud | AWS EC2 (t2.micro, Ubuntu 20.04) |
| IP | Elastic IP for persistence |
| Reverse proxy | Nginx |
| TLS | HTTPS via SSL certificate |
| CORS | Nginx header management |
| Memory | 2GB swap file for Node.js + Python |
| Database | SQLite3 |

Data loading scripts (`save_recipes_to_database.py`, `save_restaurants_to_database.py`) read pre-computed embedding CSVs and populate the Django ORM, decoupling the expensive NLP pipeline from the real-time serving infrastructure.

## Tech Stack

Python (3.8+), Django (3.1) + Django REST Framework (3.12), React (17.0.2), Material-UI (5.3), HuggingFace Transformers (BERT, DistilBERT), Sentence-Transformers, scikit-learn (KNN/KD-tree), KeyBERT, YAKE, RAKE-NLTK, NLTK, Gensim (GloVe), BeautifulSoup4, Pandas, NumPy, Axios, Nginx, AWS EC2

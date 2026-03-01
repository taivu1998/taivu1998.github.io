---
layout: page
title: "StockViz: Real-Time Pairs Trading Dashboard with JPMorgan Perspective"
description: "A full-stack streaming analytics dashboard computing dual-stock mid-price ratios with static threshold bands and trigger alerts"
importance: 7
category: "Web & App Development"
github: https://github.com/taivu1998/StockViz-Trading
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/StockViz-Trading)

## Overview

StockViz is a **real-time pairs trading ratio monitoring dashboard** built during the JPMorgan Chase Software Engineering Virtual Experience. The system combines a **Python-based synthetic order book simulator** (threaded HTTP server generating 5-year bounded random walk market data) with a **TypeScript React frontend** that polls at 100ms intervals, computes dual-stock **mid-price ratios** from top-of-book quotes, and visualizes them against **static ±5% threshold bands** via JPMorgan's **Perspective.js** — a WebAssembly-powered, GPU-accelerated streaming data visualization library (open-sourced under FINOS). The `<perspective-viewer>` web component renders a multi-series `y_line` chart with four overlaid layers (ratio, upper bound, lower bound, trigger alert), enabling traders to identify **mean-reversion arbitrage signals** when the price ratio breaches configurable bands.

## System Architecture

```
[Python Order Book Simulator]  ──HTTP /query──>  [React TypeScript SPA]
         │                                              │
    server3.py                                    App.tsx (polling)
    ├── bwalk() bounded random walk               ├── DataStreamer.ts (sync XHR)
    ├── market() stochastic generator             ├── DataManipulator.ts (analytics)
    ├── orders() limit order generation           └── Graph.tsx (Perspective.js)
    ├── order_book() bid/ask matching                   │
    └── ThreadingMixIn HTTP server                <perspective-viewer>
         (port 8080)                                (WebAssembly y_line chart)
```

The system operates in two layers: (1) **backend** — Python 3 `http.server` with `ThreadingMixIn` reads a pre-generated 5-year synthetic CSV, maintains per-stock order books with aging/clearing, and serves top-of-book JSON at `/query`; (2) **frontend** — React SPA polls every 100ms for 1000 iterations (~100s streaming window), computes mid-prices and ratio analytics in `DataManipulator.ts`, and feeds processed rows into a Perspective table for real-time chart updates.

## Order Book Simulation Engine

### Bounded Random Walk Market Data

The backend generates **entirely synthetic market data** using a stochastic bounded random walk — no external APIs:

```python
# Bounded random walk: value bounces within [min, max] via modular arithmetic
def bwalk(min, max, std):
    rng = max - min
    while True:
        max += normalvariate(0, std)
        yield abs((max % (rng * 2)) - rng) + min

# Configuration: price $60-150 (σ=1), spread $2-6 (σ=0.1), freq 12-36h (σ=50)
SPD  = (2.0, 6.0, 0.1)
PX   = (60.0, 150.0, 1)
FREQ = (12, 36, 50)
```

The `market()` generator produces `(timestamp, price, spread)` tuples, and `orders()` converts these into random limit orders for stocks ABC and DEF with random side (buy/sell) and size. On first run, a **5-year simulated dataset** (`SIM_LENGTH = timedelta(days=365*5)`) is written to CSV; subsequent runs read from this pre-generated file.

### Limit Order Book with Aging and Clearing

```python
def add_book(book, order, size, _age=10):
    yield order, size, _age
    for o, s, age in book:
        if age > 0:
            yield o, s, age - 1  # Decrement age, expire at 0
```

Each order has a configurable age counter (default 10). New orders decrement all existing orders by 1, simulating cancellation/expiration. `clear_order()` recursively matches orders against the opposite side using comparison operators (`operator.ge` for sells, `operator.le` for buys), and `clear_book()` iteratively resolves crossed books (best bid ≥ best ask).

### Real-Time Simulation

When `REALTIME = True`, the server **maps simulated historical time to wall-clock time**: events are gated by `sim_start + (datetime.now() - rt_start)`, creating the illusion of a live market feed. The first 10 events are skipped (`read_10_first_lines`) to allow order books to build sufficient depth before serving queries. On data exhaustion, `self.__init__()` reinitializes the server, effectively looping the 5-year dataset.

## Frontend Analytics Pipeline

### TypeScript React Application

| Component | Technology | Role |
|-----------|-----------|------|
| Framework | React 16.9 + TypeScript 3.2 | Component-based SPA |
| Visualization | Perspective.js 0.2.12 (FINOS/JPMorgan) | WebAssembly-powered streaming charts |
| Chart backend | perspective-viewer-highcharts | Highcharts rendering plugin |
| Styling | Bootstrap 4.2 | Layout and button styling |
| Build | Create React App 2.1 | Webpack + Babel toolchain |

**Component hierarchy**: `index.tsx` (entry point, global `window.perspective` declaration) → `App.tsx` (polling controller, `setInterval` at 100ms) → `DataStreamer.ts` (synchronous XHR to `/query`) → `DataManipulator.ts` (mid-price + ratio computation) → `Graph.tsx` (Perspective table + viewer configuration).

### Mid-Price Ratio Computation

```typescript
// DataManipulator.ts — core analytics engine
const priceABC = (serverResponds[0].top_ask.price + serverResponds[0].top_bid.price) / 2;
const priceDEF = (serverResponds[1].top_ask.price + serverResponds[1].top_bid.price) / 2;
const ratio = priceABC / priceDEF;

const upperBound = 1 + 0.05;  // Static +5% band
const lowerBound = 1 - 0.05;  // Static -5% band
trigger_alert: (ratio > upperBound || ratio < lowerBound) ? ratio : undefined,
```

The **mid-price** (midpoint of best bid and best ask) filters out spread noise, providing a fairer estimate of the "true" price. The **price ratio** (ABC/DEF) is the fundamental pairs trading signal — when historically correlated stocks diverge beyond the ±5% bands, a mean-reversion trade is signaled. The **trigger alert** fires by plotting the ratio only when it breaches a bound; `undefined` values leave gaps in the line, visually highlighting anomalous crossings.

### Perspective.js Chart Configuration

```typescript
// Graph.tsx — WebAssembly-powered streaming visualization
elem.setAttribute('view', 'y_line');                    // Multi-series line chart
elem.setAttribute('row-pivots', '["timestamp"]');       // X-axis: time series
elem.setAttribute('columns', '["ratio", "lower_bound", "upper_bound", "trigger_alert"]');
elem.setAttribute('aggregates', JSON.stringify({
    ratio: 'avg', upper_bound: 'avg', lower_bound: 'avg',
    trigger_alert: 'avg', timestamp: 'distinct count',
}));
```

Four Perspective modules are loaded via CDN: (1) **`perspective`** — core Apache Arrow + WebAssembly engine for columnar data operations, (2) **`perspective-viewer`** — the `<perspective-viewer>` web component, (3) **`perspective-viewer-hypergrid`** — tabular/spreadsheet view plugin, (4) **`perspective-viewer-highcharts`** — Highcharts rendering backend. The typed schema defines 7 columns (`price_abc`, `price_def`, `ratio`, `timestamp`, `upper_bound`, `lower_bound`, `trigger_alert`) with `float`/`date` types, where duplicate-timestamp rows are aggregated via `avg` to prevent visual noise.

## Pairs Trading Strategy

The dashboard implements the **visualization layer for a mean-reversion pairs trading strategy**:

1. **Hypothesis**: Stocks ABC and DEF are cointegrated — their price ratio reverts to a stable mean of ~1.0
2. **Signal**: When `ratio > 1.05` (ABC relatively overvalued) → short ABC / long DEF; when `ratio < 0.95` → long ABC / short DEF
3. **Exit**: Close position when ratio returns to the equilibrium range [0.95, 1.05]

The static threshold bands function as simplified **Bollinger Band analogs** — unlike true Bollinger Bands (rolling mean ± N standard deviations), these are fixed at ±5% around the assumed equilibrium ratio.

## Server Response Format

The `/query` endpoint returns top-of-book quotes for both instruments:

```json
[
  { "stock": "ABC", "timestamp": "...", "top_bid": {"price": 105.23, "size": 47}, "top_ask": {"price": 108.91, "size": 12} },
  { "stock": "DEF", "timestamp": "...", "top_bid": {"price": 98.44, "size": 81}, "top_ask": {"price": 101.17, "size": 33} }
]
```

CORS is enabled via `Access-Control-Allow-Origin: *`, and the server uses a decorator-based routing framework where routes are discovered by introspecting class methods for `__route__` attributes with regex matching against request paths.

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/JPMorganChase_Demo.gif" title="Stock Charts Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python 3 (http.server, ThreadingMixIn, csv, random, json), TypeScript (3.2), React (16.9), Perspective.js (0.2.12 — JPMorgan/FINOS), Perspective-viewer-highcharts, Bootstrap (4.2), Create React App, Webpack

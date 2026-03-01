---
layout: page
title: "GraphViz: Force-Directed Graph Layout with Real-Time Qt Animation"
description: "A C++ implementation of the Fruchterman-Reingold algorithm for visualizing nodes and edges in a graph"
importance: 20
category: "Web & App Development"
github: https://github.com/taivu1998/GraphViz
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/GraphViz)

## Overview

GraphViz is a **C++17 desktop application** that implements a **Fruchterman-Reingold force-directed graph layout algorithm** with real-time animation via the Qt framework. The physics simulation applies **Hooke's-law attractive forces** along edges (`F_attract = k * d²`) and **Coulomb-like repulsive forces** between all node pairs (`F_repel = k / d`), iterating in a tight computation loop on a **worker thread** while a Qt widget renders the evolving layout via **signal-slot communication with semaphore-based frame dropping**. The system starts from a **uniform circular initial placement** and converges to aesthetically pleasing layouts where connected nodes cluster and edge crossings are minimized. Ships with **35 pre-built graph files** spanning Platonic solids (cube, dodecahedron, icosahedron), named graphs from combinatorics (Petersen, Heawood, Desargues, Mobius-Kantor, Moser spindle), and parametric families (cliques up to K30, grids up to 10×10, binary trees up to 127 nodes).

## Force-Directed Layout Algorithm

### Physics Model

The algorithm is a variant of **Fruchterman-Reingold force-directed placement** — a physics-based simulation where nodes are treated as charged particles connected by springs:

**Attractive forces** (Hooke's law along edges):

```cpp
// For each edge (start, end): F_attract = k_attract * d²
double Fattract = kattract * (xDiff * xDiff + yDiff * yDiff);
double theta = atan2(yDiff, xDiff);
deltaX[edge.start] += Fattract * cos(theta);   // Pull start toward end
deltaY[edge.start] += Fattract * sin(theta);
deltaX[edge.end] -= Fattract * cos(theta);     // Pull end toward start
deltaY[edge.end] -= Fattract * sin(theta);
```

**Repulsive forces** (Coulomb's law between all node pairs):

```cpp
// For each pair (i, j): F_repel = k_repel / d
double Frepel = krepel / sqrt(xDiff * xDiff + yDiff * yDiff);
double theta = atan2(yDiff, xDiff);
deltaX[i] -= Frepel * cos(theta);   // Push i away from j
deltaY[i] -= Frepel * sin(theta);
deltaX[j] += Frepel * cos(theta);   // Push j away from i
deltaY[j] += Frepel * sin(theta);
```

With equal force constants (`k_attract = k_repel = 0.001`), the equilibrium edge length satisfies `k * d² = k / d` → **d³ = 1** → **d = 1 unit**, meaning the algorithm converges to layouts where edge lengths approach 1 in the internal coordinate system.

### Initial Placement and Iteration

Nodes begin at **uniformly-spaced positions on the unit circle**:

```cpp
for (size_t k = 0; k < n; ++k) {
    graph.nodes[k] = {cos(2 * kPi * k / n), sin(2 * kPi * k / n)};
}
```

Each iteration accumulates force deltas into temporary vectors `deltaX[n]` and `deltaY[n]`, then applies them simultaneously — an **Euler integration** step. The simulation runs in a continuous loop for a user-specified duration (measured via `std::chrono::high_resolution_clock`), calling `DrawGraph()` after each iteration for real-time animation.

### Computational Complexity

| Phase | Per Iteration | Notes |
|-------|:------------:|-------|
| Attractive forces | **O(\|E\|)** | Iterates over all edges |
| Repulsive forces | **O(\|V\|²)** | Iterates over all node pairs |
| Position update | **O(\|V\|)** | Apply accumulated deltas |
| **Total** | **O(\|V\|² + \|E\|)** | Dominated by repulsive force computation |

For the largest included graph (127-node binary tree), this means ~8,001 pair comparisons per iteration.

## Multi-Threaded Qt Rendering Architecture

### Threading Model

```
┌─────────────────────────┐      Qt Signal/Slot      ┌─────────────────────────┐
│    WORKER THREAD         │ ──────────────────────→  │    MAIN (GUI) THREAD     │
│                          │    graphUpdated(graph)    │                          │
│  _userMain():            │                          │  QApplication::exec()    │
│    parse graph file      │  ←── QSemaphore{1} ───  │  MyWidget::paintEvent()  │
│    compute forces        │      (back-pressure)     │    QPainter rendering    │
│    call DrawGraph()      │                          │    release semaphore     │
└─────────────────────────┘                           └─────────────────────────┘
```

- **Main thread**: Runs the Qt event loop, handles all GUI rendering via `QPainter`
- **Worker thread**: `QThread` subclass running the force-directed simulation at maximum CPU speed

### Signal-Slot Communication with Frame Dropping

```cpp
void SimpleGraph::drawGraph() {
    if (!semaphore.tryAcquire()) return;   // Frame drop if GUI still painting
    // Copy graph data to widget, emit graphUpdated signal
}

void MyWidget::paintEvent(QPaintEvent*) {
    // ... render edges and nodes via QPainter ...
    semaphore.release();                    // Signal readiness for next frame
}
```

The `QSemaphore{1}` acts as a **lock-free back-pressure mechanism**: the algorithm thread can only queue one redraw at a time. If computation outpaces rendering, frames are silently dropped via `tryAcquire()` — ensuring the physics simulation runs at maximum speed regardless of display refresh rate.

### The `#define main` Bridging Hack

A technically unusual pattern reconciles two conflicting requirements — Qt needs `main()` for `QApplication`, while the user's algorithm also needs `main()`:

```cpp
// SimpleGraph.h: rename user's main
#define main _userMain

// SimpleGraph.cpp: restore and define the real main
#undef main
int main(int argc, char **argv) {
    QApplication app(argc, argv);
    WorkerThread worker;
    worker.start();          // Runs _userMain() on separate thread
    return app.exec();       // Qt event loop on main thread
}
```

## QPainter Rendering Engine

### Dynamic Coordinate Normalization

Node positions (arbitrary real-valued coordinates) are dynamically scaled to fit the 600×600 window every frame using min-max normalization:

```cpp
auto scale = [maxX, maxY, minX, minY](const Node& a) -> Node {
    return {
        (a.x - minX) * (kWindowWidth - kCircleDiameter) / (-minX + maxX) + kCircleRadius,
        (a.y - minY) * (kWindowHeight - kCircleDiameter) / (-minY + maxY) + kCircleRadius
    };
};
```

As the force-directed layout evolves and the bounding box changes, the visualization **auto-rescales every frame** — the graph always fills the window. A degenerate-case guard (all nodes collinear) prevents division by zero.

### Visual Design

| Element | Specification |
|---------|:------------:|
| Window | 600×600 pixels |
| Background | Black (`#000000`) |
| Nodes | 14px cyan circles (`#92FCFF`) with dark borders (`#0d0d0d`) |
| Edges | Medium gray lines (`#606060`) |
| Rendering order | Background → edges → nodes (nodes on top) |

## Graph Data Structures

```cpp
struct Node { double x, y; };                       // 2D position
struct Edge { std::size_t start, end; };            // Undirected edge (index pair)
struct SimpleGraph {
    std::vector<Node> nodes;
    std::vector<Edge> edges;
};
```

**Edge list representation** — two flat vectors for nodes and edges. This is memory-efficient for sparse graphs and natural for the force computation, which iterates over edges and node pairs independently. The `SimpleGraph` struct is transparently enhanced into a Qt `QObject` subclass via macro renaming for signal/slot support.

## 35 Pre-Built Graph Library

### Platonic Solids

| Graph | Nodes | Edges | Description |
|-------|:-----:|:-----:|-------------|
| `cube` | 8 | 12 | Q3 hypercube |
| `octahedron` | 6 | 12 | K_{2,2,2} |
| `dodecahedron` | 20 | 30 | Regular dodecahedron |
| `icosahedron` | 12 | 30 | Regular icosahedron |

### Named Graphs from Combinatorics

| Graph | Nodes | Edges | Significance |
|-------|:-----:|:-----:|-------------|
| `petersen` | 10 | 15 | Famous counterexample in graph theory |
| `heawood` | 14 | 21 | Smallest cubic graph of girth 6 |
| `desargues` | 20 | 30 | Desargues configuration graph |
| `mobius-kantor` | 16 | 24 | Generalized Petersen GP(8,3) |
| `moser-spindle` | 7 | 11 | Unit-distance graph requiring 4 colors |
| `durer` | 12 | 18 | Skeleton of Durer's solid |
| `tietze` | 12 | 18 | Tietze's graph |
| `tesseract` | 16 | 32 | 4-dimensional hypercube Q4 |

### Parametric Graph Families

| Family | Instances | Range |
|--------|-----------|-------|
| **Complete graphs** (K_n) | `5clique`, `10clique`, `30clique` | 5–30 nodes |
| **Path graphs** | `2line`, `10line`, `50line` | 2–50 nodes |
| **Cycle graphs** | `30cycle`, `60cycle` | 30–60 nodes |
| **Grid graphs** | `3grid`, `5grid`, `10grid` | 3×3 to 10×10 |
| **Wheel graphs** (W_n) | `8wheel`, `32wheel`, `64wheel` | 8–64 nodes |
| **Binary trees** | `31binary-tree`, `63binary-tree`, `127binary-tree` | 31–127 nodes |

### Graph File Format

Plain text with node count on line 1 followed by edge pairs:

```
8          ← 8 nodes (indexed 0-7)
0 1        ← edge between node 0 and node 1
1 2
2 3
3 0
4 5
5 6
6 7
7 4
0 4
1 5
2 6
3 7        ← cube graph (Q3)
```

## Animation Effect

The user observes a real-time convergence process:

1. **Initial state**: Nodes arranged in a perfect circle (uniform angular spacing)
2. **During simulation**: Nodes visibly migrate — connected nodes attract, all nodes repel, edge crossings reduce
3. **At equilibrium**: Aesthetically pleasing layout with roughly uniform edge lengths and well-separated nodes

The animation runs for a user-specified duration, with the force-directed algorithm computing at maximum CPU throughput while the Qt renderer displays frames at display speed.

## Tech Stack

C++17, Qt (QWidget, QPainter, QThread, signals/slots, QSemaphore, qmake), STL (`std::vector`, `std::transform`, `std::chrono`, `std::move`, lambdas, range-based for)

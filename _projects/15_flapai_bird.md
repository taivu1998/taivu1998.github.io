---
layout: page
title: "FlapAI Bird: Deep Reinforcement Learning for Flappy Bird"
description: "A Flappy Bird agent that achieved superhuman performance using reinforcement learning algorithms"
importance: 15
category: "Artificial Intelligence"
github: https://github.com/taivu1998/FlapAI-Bird
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/FlapAI-Bird)
[![](https://img.shields.io/badge/Paper-Read_paper-brightgreen?logo=affinity-publisher)](https://arxiv.org/abs/2003.09579)
[![](https://img.shields.io/badge/Poster-View_poster-orange?logo=styleshare)](https://taivu1998.github.io/assets/files/projects/FlapAI-Bird_Poster.pdf)

## Overview

Published as [arXiv:2003.09579](https://arxiv.org/abs/2003.09579), FlapAI Bird implements **six progressively sophisticated value-based RL algorithms** — from a random baseline through tabular SARSA and Q-Learning, linear function approximation, feed-forward DQN, to convolutional DQN with experience replay — all evaluated on the same Flappy Bird environment via OpenAI Gym wrappers around the PyGame Learning Environment (PLE). The system achieves **superhuman performance of 2,069 pipes** (vs. human baseline of ~20–50) after 10,000 training episodes. Two key design innovations drive performance: (1) **backward trajectory processing** that propagates the −1000 death penalty in reverse chronological order for dramatically faster credit assignment, and (2) **biased exploration priors** via a tunable `probFlap` parameter (default 0.1) encoding domain knowledge that no-flap is the safer action. The convolutional DQN operates directly on **80×80 binary-thresholded pixel frames** with a 50,000-transition experience replay buffer, while tabular methods use a 3-feature discretized state representation. All agents share a unified Gym wrapper interface with shaped rewards (+0.5 survival, +5.0 pipe passage, −1000 death) and undiscounted returns (γ=1.0).

## Six RL Algorithm Progression

| Agent | Algorithm | State Input | Value Storage | Parameters | Update |
|-------|-----------|:-----------:|:------------:|:----------:|:------:|
| **Baseline** | Random (probFlap) | — | None | 0 | None |
| **SARSA** | On-policy TD(0) | Discretized string | Dict | O(\|S\|×\|A\|) | Tabular |
| **Q-Learning** | Off-policy TD(0) | Discretized string | Dict | O(\|S\|×\|A\|) | Tabular |
| **Linear FA** | Semi-gradient TD | 5 normalized features | Weight vector | 5 | Manual SGD |
| **DNN-DQN** | DQN (3-layer MLP) | 3 continuous | Neural net | 1,262 | PyTorch SGD |
| **CNN-DQN** | DQN + Experience Replay | 80×80 pixels | Neural net | 31,746 | PyTorch Adam |

## State Representations

The system provides **four specialized Gym wrappers** (`FlappyBirdNormal`, `FlappyBirdLR`, `FlappyBirdDNN`, `FlappyBirdCNN`), each exposing algorithm-appropriate state representations from the same underlying PLE environment:

**Tabular methods** (SARSA, Q-Learning): Three features discretized via `discretize(x, rounding) = rounding × ⌊x / rounding⌋` — `player_vel`, `hor_dist_to_next_pipe`, `ver_dist_to_next_pipe` — concatenated into a string key for dictionary-based Q-tables. The `rounding` parameter controls a bias-variance trade-off: too fine yields sparse tables with slow convergence; too coarse causes state aliasing.

**Linear FA**: Five normalized features — `player_vel/10`, `hor_dist/288` (screen width), `ver_dist/512` (screen height), action, bias — with sparse dictionary-based weight vectors and manual semi-gradient updates.

**DNN-DQN**: Raw 3D continuous vector `[player_vel, hor_dist, ver_dist]` without normalization.

**CNN-DQN**: 80×80 binary-thresholded pixel frames (see Frame Preprocessing Pipeline below).

## Reward Shaping

| Event | Reward | Purpose |
|-------|:------:|---------|
| Surviving a timestep | **+0.5** | Continuous survival incentive |
| Passing through a pipe | **+5.0** | Milestone reward (PLE returns +1, reshaped to +5) |
| Death/collision | **−1000** | Large terminal penalty for credit assignment |

With undiscounted returns (γ=1.0), the −1000 death penalty treats all future rewards equally, appropriate for Flappy Bird where survival at any future point is equally valuable — but Q-values can grow unboundedly for long episodes.

## Tabular Methods: SARSA vs. Q-Learning

Both use `defaultdict(float)` Q-tables with the same epsilon-greedy exploration, differing only in their TD targets:

**SARSA** (on-policy): `Q(s,a) ← (1−η)·Q(s,a) + η·(r + γ·Q(s',a'))` where `a'` is the action **actually selected** by the current epsilon-greedy policy — the next action is chosen *before* the update, making transitions `(s, a, r, s', a')`.

**Q-Learning** (off-policy): `Q(s,a) ← (1−η)·Q(s,a) + η·(r + γ·max_{a'} Q(s',a'))` using the greedy max over all next actions regardless of the exploration policy.

This makes SARSA more conservative — it accounts for the "cost of exploration" since it evaluates the policy it's following, while Q-Learning always targets the optimal policy.

## Backward Trajectory Processing

One of the most impactful design decisions: transitions within an episode can be processed in **reverse chronological order** (`--order backward`). The large −1000 death penalty at episode termination is propagated backward through the trajectory *before* earlier transitions are updated, dramatically improving credit assignment for long episodes where the death signal would otherwise take many episodes to propagate to early states through forward processing alone. Q-Learning with backward updates achieves the strongest overall performance.

## Neural Network Architectures

### Feed-Forward DNN (1,262 parameters)

```
Input [3] → Linear(3→50) → ReLU → Linear(50→20) → ReLU → Linear(20→2) → ReLU → Output [2]
```

Per-transition online updates via SGD (`lr=0.1`), no experience replay. Uses MSE loss between `Q(s,a)` and `r + γ·max_{a'} Q(s',a')`.

### Convolutional DQN (31,746 parameters)

```
Input [1×80×80] → Conv2d(1→16, k=5, s=2) → ReLU → Conv2d(16→32, k=5, s=2) → ReLU
  → Flatten [9,248] → Linear(9248→2) → Output [2]
```

| Layer | Input → Output | Config | Parameters |
|-------|:--------------:|:------:|:----------:|
| Conv2d 1 | 1×80×80 → 16×38×38 | k=5, s=2 | 416 |
| Conv2d 2 | 16×38×38 → 32×17×17 | k=5, s=2 | 12,832 |
| Linear | 9,248 → 2 | — | 18,498 |

Deliberately compact compared to the original Atari DQN (~1.7M parameters). Uses Adam optimizer, minibatch size 32, and 50,000-transition experience replay buffer with 5,000-step warm-up. Actions encoded as one-hot vectors via `torch.eye(2)` with Q-value selection via element-wise multiplication — an elegant vectorized alternative to index-based selection. The `survived` mask (1 − done) zeros out the bootstrap term for terminal states.

## Experience Replay (CNN Agent)

| Property | Specification |
|----------|:------------:|
| Buffer | `collections.deque(maxlen=50,000)` — FIFO ring buffer |
| Transition | `(state, action_onehot, reward, nextState, survived)` |
| Sampling | Uniform random without replacement |
| Warm-up | 5,000 transitions before training begins |
| Batch size | 32 |

During warm-up, the agent explores and stores transitions but does not call `updateWeights`, ensuring sufficient replay diversity before gradient updates start.

## Frame Preprocessing Pipeline

The CNN agent processes raw game frames through a `torchvision.transforms.Compose` chain:

1. **Crop**: `frame[:404]` — removes bottom score display from the 512-pixel-high frame
2. **Grayscale**: 3 RGB channels → 1 intensity channel
3. **Resize**: ~288×404 → 80×80 pixels (significant spatial compression)
4. **Binary threshold**: Otsu-style at intensity 128 — all pixels >128 become 255 (white), others 0 (black)
5. **Tensor conversion**: `ToTensor()` normalizes to `[0, 1]`
6. **Batch dimension**: Final output `[1, 1, 80, 80]`

The aggressive binarization eliminates color variation, texture noise, and lighting effects, reducing the visual problem to pure structural/positional information. Unlike the original Atari DQN which stacks 4 consecutive frames to capture motion, this implementation uses **single frames only** — the network must infer dynamics purely from static positions.

## Exploration: Biased Epsilon-Greedy

All agents use **biased random action selection** during exploration:

```python
def randomAct():
    return 0 if random.random() < probFlap else 1  # flap only 10% of the time
```

Rather than uniform random actions, the `probFlap` parameter (default 0.1) encodes domain knowledge that no-flap is the safer action — a form of informed exploration prior. With probability ε, the agent executes this biased random action; otherwise, it selects the greedy action (ties broken by `randomAct`).

**Decay schedules** (Robbins-Monro conditions): `ε_t = ε₀ / (t + 1)` (harmonic epsilon decay), `η_t = η · (t+1) / (t+2)` (slow learning rate decay).

## Training Configuration

| Parameter | Tabular | Linear FA | DNN | CNN |
|-----------|:-------:|:---------:|:---:|:---:|
| Training episodes | 10,000 | 10,000 | 10,000 | 10,000 |
| Eval frequency | Every 250 | Every 250 | Every 250 | Every 250 |
| Learning rate | 0.8 | 0.1 | 0.1 | 0.1 |
| Discount (γ) | 1.0 | 1.0 | 1.0 | 1.0 |
| Optimizer | Direct update | Manual SGD | PyTorch SGD | PyTorch Adam |
| Replay buffer | — | — | — | 50,000 |
| Batch size | — | — | 1 (online) | 32 |
| Update timing | Once per episode | Once per episode | Once per episode | Every timestep |

## Results

| Configuration | Peak Score | Consistent Performance |
|--------------|:----------:|:---------------------:|
| Human baseline | 20–50 pipes | — |
| Q-Learning (backward, η=0.8) | **2,069 pipes** | **>1,400 pipes** after 10K episodes |
| SARSA (backward) | ~1,800 pipes | >1,200 pipes |
| CNN-DQN (with replay) | ~1,000 pipes | Improving with more training |

**Key findings**: (1) **Backward trajectory processing** provides the single largest performance boost by efficiently propagating the −1000 death signal. (2) **Off-policy Q-Learning outperforms on-policy SARSA** — learning the optimal policy regardless of exploration noise. (3) **State discretization critically impacts tabular methods** — the `rounding` parameter controls a bias-variance trade-off. (4) CNN agents learn directly from pixels but require higher sample complexity, demonstrating the cost of learning visual features from scratch vs. hand-crafted state representations.

## Demo

<div class="row">
    <div class="col-sm-6 mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/FlapAI-Bird_Demo.gif" title="FlapAI Bird Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/FlapAI-Bird_Poster.png" title="FlapAI Bird Poster" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

Python (3.7+), PyTorch (neural networks + autograd), OpenAI Gym (environment interface), PyGame Learning Environment (Flappy Bird simulator), torchvision (frame preprocessing), OpenCV (binary thresholding), NumPy

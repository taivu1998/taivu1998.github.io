---
layout: page
title: "Agentic Deep Research: Recursive Reasoning and Self-Correction Engine"
description: "A multi-agent deep research engine with dynamic DAGs, self-correction loops, and LLM-as-a-Judge evaluation"
importance: 4
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Recursive-Deep-Research
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Recursive-Deep-Research)

## Overview

An agentic deep research engine that scales inference-time compute to answer complex, multi-faceted questions through iterative reasoning loops with self-correction. The system implements a **four-agent, DAG-orchestrated research pipeline** built on LangGraph's `StateGraph` — where a Planner decomposes queries into dependency-aware sub-question DAGs, parallel Executors perform web search with context-aware summarization, an Aggregator synthesizes findings, and a Critic evaluates completeness and dynamically extends the research plan when gaps are identified. Unlike static RAG, the research plan **grows organically** based on intermediate findings, achieving **+14.1% factuality improvement** and **2× the perfect-answer rate** over single-shot baselines on a 50-question compositional benchmark.

## Multi-Agent Architecture

The coordination is managed through a compiled LangGraph `StateGraph` with conditional edges and Pydantic-validated structured outputs at every LLM boundary:

| Agent | Model | Role |
|-------|-------|------|
| **Planner** | Claude Sonnet 4 | Decomposes complex queries into dependency-aware DAGs of atomic `SubQuery` nodes (id, question, dependencies, reasoning) via structured output |
| **Executor** | Tavily Search + GPT-4o-mini | Identifies runnable steps (dependencies satisfied), executes web searches in parallel via `ThreadPoolExecutor`, and synthesizes results with dependency context |
| **Aggregator** | Claude Sonnet 4 | Builds structured context from all completed sub-questions and synthesizes a comprehensive, citation-grounded answer |
| **Critic** | Claude Sonnet 4 | Harsh "Research Director" evaluation — assesses completeness, factuality, and specificity; generates new `SubQuery` nodes to fill identified gaps |
| **Judge** | GPT-4o | Independent A/B evaluation with LLM-as-a-Judge scoring (offline, not in the inference loop) |

**Model Stratification**: Expensive reasoning models (Claude Sonnet) are used only for planning, critique, and synthesis; cost-efficient models (GPT-4o-mini) handle mechanical summarization — keeping costs to ~$0.10/query despite the multi-step pipeline.

## Core Research Loop

```
ENTRY → Planner → Executor ──(more runnable steps?)──→ Executor (wave execution)
                                    ↓ (all steps done)
                              Aggregator → Critic ──(gaps found?)──→ Executor (new sub-questions)
                                                        ↓ (sufficient or max_loops reached)
                                                       END
```

### Dynamic DAG Planning

The Planner produces a Pydantic-validated `ResearchPlan` with explicit dependency graphs. The key innovation: the DAG is **not static**. When the Critic identifies gaps, it generates new `SubQuery` nodes with IDs starting after the current maximum. Because the `AgentState.plan` field uses `Annotated[List[SubQuery], operator.add]`, new steps are appended seamlessly without plan reconstruction — implementing genuine inference-time adaptive computation.

### Dependency-Aware Parallel Execution

The Executor implements DAG-based scheduling: only steps with satisfied dependencies execute, and they run concurrently via `ThreadPoolExecutor(max_workers=min(len(runnable), 5))`. Each step's summarization includes dependency context — later steps leverage findings from earlier steps during synthesis, enabling true multi-hop reasoning where one search informs the interpretation of the next. After each execution wave, newly-runnable steps are identified for the next wave.

### Self-Correction Loop

The Critic uses a deliberately harsh evaluation prompt and returns a structured `Assessment` (is_sufficient, feedback, new_sub_questions). Three safety mechanisms bound the recursion: (1) `max_loops=3` circuit breaker, (2) completion check when the critic is satisfied, (3) pending-step detection to avoid empty iterations.

## Evaluation Framework

**Benchmark**: A curated Golden Set of 50 hard compositional questions spanning 7 categories — multi-hop reasoning, temporal comparison, temporal-financial, aggregation, temporal-factual, temporal-economic, and direct comparison.

**Protocol**: A/B comparison against a NaiveRAG baseline (single Tavily search + single GPT-4o-mini answer). GPT-4o judges both systems on completeness, factuality, and coherence (1–5 scale) via Pydantic-validated structured output. The harness supports checkpoint resumability via pickle-based `EvaluationCheckpoint` with per-question tracking, cost estimation, and category-level analysis.

## Results

| Metric | RecursiveAgent | NaiveRAG | Improvement |
|--------|:--------------:|:--------:|:-----------:|
| **Factuality** | **4.04/5** | 3.54/5 | **+14.1%** |
| Completeness | 4.42/5 | 4.30/5 | +2.8% |
| Coherence | 4.64/5 | 4.54/5 | +2.2% |
| Perfect Scores (5/5/5) | 30% | 16% | **+14pp** |
| Win Rate | 50% | 14% | — |

**Category strengths**: Temporal-comparison (80% win rate), temporal-economic (75%), temporal-financial (57%). The agent excels on queries requiring cross-temporal synthesis and multi-source aggregation — precisely the scenarios where iterative DAG expansion and self-correction provide the most value.

## Tech Stack

Python, LangGraph, LangChain, Pydantic, Anthropic Claude (Sonnet 4), OpenAI GPT-4o / GPT-4o-mini, Tavily Search API, PyTorch

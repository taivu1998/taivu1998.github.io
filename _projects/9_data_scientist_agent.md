---
layout: page
title: "Data-Scientist-Agent: Multimodal Code-Actuated Agent via Visual Verification"
description: "An autonomous data science agent for data analytics and visualization, with a VLM critic for visual verification"
importance: 9
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Data-Scientist-Agent
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Data-Scientist-Agent)

## Overview

A code-actuated data science agent that addresses a fundamental blind spot in LLM agent loops: **silent chart hallucinations** — code that executes without errors but produces empty axes, incorrect labels, wrong plot types, or visualizations that don't answer the user's query. Traditional agent loops rely on execution status (exit codes, stderr) for success detection, but visualization correctness is a *visual* property that can only be verified by inspecting the rendered output. The core innovation is a **Visual Critic** node — a Vision-Language Model that receives the rendered chart as a base64 PNG and returns Pydantic-validated structured feedback (`is_valid`, `has_title`, `has_labels`, `has_data`, `feedback`) — integrated into a LangGraph `StateGraph` with conditional routing that triggers code refinement when visual deficiencies are detected. Code executes in **E2B Firecracker microVMs** (AWS Lambda-grade isolation) with persistent Jupyter kernel state across retries. The delta between Pass@1 and Pass@3 directly quantifies the visual feedback loop's effectiveness — demonstrating recovery from failures invisible to text-only verification.

## LangGraph State Machine Architecture

The agent is a compiled `StateGraph` with 5 nodes and 2 conditional routing edges:

```
ENTRY → Planner → Coder → Executor → should_continue()
                    ↑                    /     |      \
                    |              "retry"  "verify"  "end" → END
                    |                /        |
                    |          Refiner   Visual Critic
                    |            ↑        → critic_router()
                    |            |          /        \
                    └────────────┘    "refine"    "end" → END
```

**Routing logic**: `should_continue()` checks execution results — if stderr AND `retry_count < max_retries`: route to `refiner`; if `image_base64` present (plot generated): route to `visual_critic` for multimodal verification; if text-only output with no errors: route to `END`. The `critic_router()` checks the visual critic's `is_valid` field — if False and retries remain: route back to `refiner` → `coder` for another attempt.

**State definition** (`AgentState` as `TypedDict`):

| Field | Type | Purpose |
|-------|------|---------|
| `messages` | `Annotated[List[BaseMessage], operator.add]` | Accumulating conversation history across graph transitions |
| `context_data` | `str` | Semantic profile of the dataset |
| `generated_code` | `str` | Current Python code to execute |
| `execution_result` | `dict` | Sandbox output (stdout, stderr, error, image_base64) |
| `retry_count` | `int` | Attempt counter (bounded by `max_retries=3`) |
| `is_solved` | `bool` | Whether visual critic approved the output |
| `original_query` | `str` | Preserved original query (never mutated across retries) |

## The Five Nodes

**Planner**: Constructs a 2–3 step execution plan from the dataset context and user query. Appended as a `SystemMessage`. Falls back to direct code generation if planning fails.

**Coder**: Generates Python code constrained by 10 explicit rules — `df` is pre-loaded (no file I/O), only `pandas`/`numpy`/`matplotlib`/`seaborn` allowed, no network calls, max 50 lines, must include titles/labels/legends for plots. When retrying, error context is prepended: `"Previous Error: {stderr}\nVisual Feedback: {visual_feedback}"`. Code extraction uses a multi-level fallback: markdown ` ```python ``` ` blocks → generic ` ``` ``` ` blocks → heuristic line-by-line parsing (detecting `import`, `df`, `plt.`, `print(`, `pd.`, `=` patterns, filtering explanatory text).

**Executor**: Sends generated code to the E2B sandbox via `SandboxWrapper.run_code()`, returns `{stdout, stderr, error, image_base64}`.

**Visual Critic** (the core innovation): Receives the rendered chart as a base64 PNG in a multimodal `HumanMessage` and returns a Pydantic-validated `VisualCritique`:

```python
class VisualCritique(BaseModel):
    is_valid: bool    # Does the chart correctly answer the query?
    has_title: bool   # Clear, readable title present?
    has_labels: bool  # Axes properly labeled?
    has_data: bool    # Visible data (not empty/blank)?
    feedback: str     # Specific, actionable improvement guidance
```

Uses `model.with_structured_output(VisualCritique)` for deterministic machine-readable routing. If `is_valid` is False, the structured feedback (boolean diagnostics + free-text guidance) propagates to the refiner, triggering the self-correction loop. If the critic itself raises an exception, the system assumes success rather than blocking — conservative fallback preventing false negatives from derailing the pipeline.

**Refiner**: Aggregates all feedback sources (runtime errors from stderr, visual feedback from critic, execution error messages) into a single `SystemMessage`, then routes back to `coder` for another attempt with full diagnostic context.

## Semantic Compression Pipeline

Instead of injecting raw CSV rows (which would exhaust context windows on large datasets), the system generates a statistical profile:

- **Numeric columns**: min, max, mean, std, missing percentage
- **Categorical columns**: unique count, top-5 frequent values (truncated to 30 chars), missing percentage
- **Datetime columns**: date range

The design insight: *"For string columns, sampling top frequent values prevents hallucinations about column content (e.g., knowing 'United States' vs 'USA')."* This preserves the structural information needed for correct code generation while reducing token consumption by orders of magnitude versus raw data injection.

## E2B Firecracker Sandbox

| Property | Specification |
|----------|---------------|
| **Isolation** | Firecracker microVMs (same technology as AWS Lambda) |
| **Template** | `code-interpreter-v1` (pre-built data science environment) |
| **Timeout** | 45 seconds per code block |
| **Kernel persistence** | Jupyter kernel maintains state across executions — `df`, imports, and variables survive across retry attempts |

**Setup code** (executed once before agent-generated code): imports `pandas`, `numpy`, `matplotlib` (Agg backend for headless rendering), `seaborn`, loads the CSV into `df`, and prints shape confirmation. The persistent kernel means the agent's generated code can reference `df` directly without re-loading — and retry attempts inherit all previous state.

**Image capture**: Iterates over E2B's `execution.results` artifacts and extracts the `.png` attribute (base64-encoded PNG from matplotlib). Only the first plot is captured per execution.

## Error Recovery and Self-Healing

| Layer | Detection | Recovery |
|-------|-----------|----------|
| **Runtime errors** | `stderr` or `error` in execution result | Error message compiled into refinement prompt; `coder` generates corrected code |
| **Visual hallucinations** | `VisualCritique.is_valid == False` | Structured feedback (has_title, has_labels, has_data, free-text) propagated to `refiner` → `coder` |
| **Code extraction failure** | No code blocks found in LLM response | Multi-level fallback: markdown → generic blocks → heuristic line parsing |
| **Planning failure** | Exception in planner node | Graceful fallback to direct code generation |
| **Sandbox timeout** | `TimeoutError` from E2B | Caught, converted to error result dict |
| **Max retries** | `retry_count >= max_retries` (default 3) | Terminates regardless of success state |

## Evaluation Framework

**Golden Set Benchmark**: 10 curated tasks across 3 difficulty tiers and 2 output types:

| Difficulty | Tasks | Types |
|-----------|:-----:|-------|
| **Easy** | 3 | Text (row count, column names, head) |
| **Medium** | 4 | Text (group-by aggregation) + Plot (bar chart, histogram, scatter) |
| **Hard** | 3 | Plot with constraints (log scale, box plot with rotated labels, annotated heatmap) |

**Validation logic**: Text tasks use case-insensitive substring matching against expected output strings. Plot tasks verify `image_base64` exists AND match `expected_visual` against code keywords (e.g., `"bar_chart"` → `["bar", "barplot"]`). Log-scale tasks additionally validate via regex: `r"set_yscale\(['\"]log"`, `r"plt\.yscale\(['\"]log"`.

**Metrics** (computed with granular difficulty/type breakdowns):

| Metric | Definition |
|--------|-----------|
| **Pass@1** | Success on first attempt (no retries needed) |
| **Pass@3** | Success within 3 attempts |
| **Pass (Refined)** | Any successful completion regardless of retry count |
| **Execution Success Rate** | Code runs without runtime exceptions |

The key research metric is the **delta between Pass@1 and Pass@3** — this directly quantifies the visual feedback loop's contribution, measuring recovery from failures that are invisible to text-only verification (code executes cleanly but the chart is wrong).

**Ablation support**: `--enable_visual_critic false` flag enables direct comparison with and without multimodal grounding, isolating the Visual Critic's contribution to task success.

## Model Configuration

| Parameter | Value |
|-----------|-------|
| **Model** | Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| **Temperature** | 0.1 (near-deterministic for reliable code generation) |
| **Provider** | Anthropic via `langchain-anthropic` |
| **Roles** | Single model instance serves 3 roles: Planner (text), Coder (text), Visual Critic (multimodal with `.with_structured_output()`) |

## Tech Stack

Python (3.10+), LangGraph (StateGraph, conditional edges), LangChain (Anthropic integration, message types), Anthropic Claude Sonnet 4, E2B Code Interpreter (Firecracker microVMs), Pydantic (structured output validation), Pandas, NumPy, Matplotlib, Seaborn, pytest (56+ tests)

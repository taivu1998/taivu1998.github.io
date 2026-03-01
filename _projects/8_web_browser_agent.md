---
layout: page
title: "Web-Browser-Agent: Multimodal Autonomous Web Navigation via Visual Grounding"
description: "A multimodal autonomous web agent with a VLM, a hybrid Set-of-Mark pipeline, and a Verify-Act-Verify loop"
importance: 8
category: "Artificial Intelligence"
github: https://github.com/taivu1998/Web-Browser-Agent
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Web-Browser-Agent)

## Overview

An autonomous web navigation agent that bridges the **grounding gap** between vision-language model perception and browser automation execution. The core innovation is a **dual-channel Set-of-Mark (SoM) grounding** system — injected JavaScript simultaneously renders numbered red tags as visual overlays (for the VLM to see in screenshots) and sets `data-agent-id` DOM attributes (for Playwright to locate elements programmatically) — eliminating the ambiguity where a VLM might describe an element but the automation layer cannot find it. A closed-loop **Verify-Act-Verify** self-correction mechanism uses pixel-level screenshot differencing to detect "ghost clicks" (actions that had no visible effect), injecting error signals into conversation history for prompt-based self-correction. Using Claude 3.5 Sonnet at temperature 0.0 with zero fine-tuning (pure prompt engineering), the agent achieves **85% step-level success rate** across a multi-category web benchmark at ~$0.27/task.

## Dual-Channel Set-of-Mark Grounding

Before each step, ~70 lines of JavaScript are injected via `page.evaluate()` that:

1. **Select interactive elements** via comprehensive CSS selectors — standard elements (`button`, `a`, `input`, `textarea`, `select`), ARIA roles (`[role="button"]`, `[role="link"]`, `[role="textbox"]`, `[role="menuitem"]`, `[role="tab"]`, `[role="checkbox"]`, `[role="combobox"]`), event-based (`[onclick]`, `[tabindex]:not([tabindex="-1"])`), and semantic (`label[for]`, `summary`)
2. **Filter for visibility** — elements must have `width > 5`, `height > 5`, not hidden/display-none/opacity-0, and within viewport bounds
3. **Tag each element via two channels simultaneously**:
   - **DOM attribute**: Sets `data-agent-id=N` on the element (Playwright uses `page.locator('[data-agent-id="N"]')` to find it)
   - **Visual overlay**: Creates an absolutely-positioned `<div>` with red border, yellow semi-transparent background, displaying number N at `z-index: 2147483647`

This dual-channel approach is the core architectural insight: the VLM sees numbered red tags in screenshots and outputs `"element_id": 5`; Playwright locates the exact DOM element via `[data-agent-id="5"]`. No XPath, no text matching, no coordinate regression — just a shared integer namespace bridging vision and DOM.

## Observe-Reason-Act-Verify Loop

```
ENTRY → Navigate to URL
  → Inject SoM JavaScript (tag + overlay interactive elements)
  → Wait 300ms for overlay render
  → Capture JPEG screenshot (1024px max, quality 70) → base64 encode
  → Build sliding-window history (text-only summaries of past steps)
  → VLM inference: [history] + [screenshot + action prompt] → JSON action
  → If action == "done": mark success, EXIT
  → Execute action via Playwright
  → If element not found (hallucination): inject error signal, CONTINUE
  → Wait 1.5s for page effects to settle
  → Capture verification screenshot
  → Compute pixel diff (256×256 grayscale, threshold 0.01)
  → If diff < threshold AND URL unchanged (ghost click): inject error signal, CONTINUE
  → Mark step success, append to history → LOOP (up to max_steps=15)
```

## Action Space

Nine discrete actions forming a complete web interaction vocabulary:

| Action | Parameters | Implementation |
|--------|-----------|----------------|
| `click` | `element_id` | `page.locator('[data-agent-id="N"]').first.click()` |
| `type` | `element_id` (opt), `text` | Click to focus → `page.keyboard.type(text, delay=50)` |
| `press_enter` | — | `page.keyboard.press("Enter")` |
| `scroll_down` | — | `window.scrollBy(0, 500)` via JS |
| `scroll_up` | — | `window.scrollBy(0, -500)` via JS |
| `wait` | — | `asyncio.sleep(2)` |
| `navigate` | `text` (URL) | `page.goto(text)` + wait for `domcontentloaded` |
| `back` | — | `page.go_back()` |
| `done` | — | Signals task completion, terminates loop |

The `type` action simulates human typing with 50ms per-character delay. The `click` action uses the SoM-assigned `data-agent-id` CSS selector — if `loc.count() == 0`, the element is flagged as hallucinated and an error signal is injected.

## Ghost Click Detection and Self-Correction

The closed-loop verification distinguishes this agent from open-loop systems that assume every action succeeds:

1. **Pre/post screenshots** are both resized to 256×256 grayscale
2. **Pixel-wise absolute difference**: `np.abs(arr_before - arr_after)`, normalized by dividing mean by 255
3. **Ghost click threshold**: If `pixel_diff < 0.01` AND URL unchanged → the action had no visible effect (clicked a disabled button, overlay intercepted the event, element wasn't interactive)
4. **Self-correction via error injection**: Rather than explicit replanning logic, error signals are injected as `user` messages in conversation history — `"System Error: Action had no visible effect. The element may be disabled or the click missed. Try a different element or approach."` — leveraging the VLM's in-context learning to naturally adjust its next action

This pixel-diff approach is computationally trivial (no neural network) yet effective at catching the most common failure mode in web agents.

## Error Taxonomy and Recovery

| Error Type | Detection | Recovery |
|-----------|-----------|----------|
| **Hallucination** | `locator('[data-agent-id=N]').count() == 0` | Inject: "Element ID N does not exist. Choose a different element." |
| **Ghost Click** | `pixel_diff < 0.01` AND URL unchanged | Inject: "Action had no visible effect... Try a different approach." |
| **JSON Parse Error** | `json.JSONDecodeError` (4-level fallback: raw → ` ```json ``` ` → ` ``` ``` ` → brace extraction) | Default to safe `wait` action |
| **API Rate Limit** | `anthropic.RateLimitError` | Exponential backoff: 2s → 4s → 8s (3 retries) |
| **API Server Error** | `APIStatusError` with `status >= 500` | Same exponential backoff |

## Token-Aware Sliding Window History

The context manager balances information retention against token costs:

- **Token budget**: 100,000 tokens (half of Claude's 200K context window)
- **Window size**: Last 3 step-pairs (user + assistant messages) kept in full
- **Older steps**: Condensed into a summary — `"Previous actions summary: [Step 1: ...first 100 chars...] [Step 2: ...]"`
- **Screenshots**: Only the **current step's screenshot** is sent to the VLM — all previous steps are text-only summaries, dramatically reducing token costs (each image costs thousands of tokens)

This design choice trades away the ability to "look back" at previous page states in exchange for ~5× lower per-step API costs.

## VLM Configuration

| Parameter | Value |
|-----------|-------|
| **Model** | Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`) |
| **Temperature** | 0.0 (deterministic) |
| **Max output tokens** | 1,024 |
| **Input** | Multimodal: base64 JPEG screenshot + text prompt |
| **Fine-tuning** | None — pure prompt engineering |
| **System prompt** | Instructs VLM to prioritize dismissing cookie banners/modals, output only valid JSON, use element IDs from red overlay tags |

The system prompt delegates complex UI challenges (popup detection, cookie consent handling) to the VLM's visual reasoning rather than building separate detection modules. The action prompt specifies the 9-action vocabulary and enforces structured JSON output: `{"thought": "...", "action": "...", "element_id": N, "text": "..."}`.

## Results

| Metric | Score |
|--------|:-----:|
| **Task Success Rate** | **67%** |
| **Step-Level Success Rate** | **85%** |
| Total benchmark cost | $2.45 (~$0.27/task) |

Evaluated across 3 benchmark tasks spanning the Mind2Web taxonomy (retrieval, navigation, form-filling) with 3 runs per task (9 total runs, up to 15 steps each). Metrics track hallucination count, ghost click count, per-task cost, and per-step success rate. Per-step screenshots and full JSON run logs are saved as artifacts for post-hoc analysis.

## Tech Stack

Python (3.10+), Playwright (async Chromium automation), Anthropic Claude API (3.5 Sonnet), Pillow, NumPy, asyncio, Rich (terminal UI), PyYAML

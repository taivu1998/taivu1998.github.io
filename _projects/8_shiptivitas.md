---
layout: page
title: "Shiptivitas: Kanban Board with Dragula-React Reconciliation"
description: "A full-stack to-do list web application based on a kanban board"
importance: 8
category: "Web & App Development"
github: https://github.com/taivu1998/Shiptivitas-To-Do-App
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/Shiptivitas-To-Do-App)

## Overview

Shiptivitas is a **full-stack kanban board** for freight shipping logistics management, built as part of Y Combinator's startup training program. The most technically interesting aspect is the **Dragula-React cancel-and-reconcile pattern** — resolving the fundamental conflict between Dragula's imperative DOM mutations and React's virtual DOM reconciliation by immediately canceling Dragula's physical node moves (`drake.cancel(true)`) and delegating all rendering to React's state-driven re-render cycle. The system features **three-swimlane drag-and-drop** (Backlog → In Progress → Complete) with **ref-based container registration**, a **data-attribute bridge** between Dragula's DOM-centric world and React's state-centric world, and **sibling-relative insertion** for drop positioning. The Express.js backend implements a **fractional-priority insertion algorithm** (`priority - 0.5` for contiguous reordering) with parameterized SQL queries against a better-sqlite3 database, versioned REST API (`/api/v1/`), and graceful shutdown handlers.

## System Architecture

```
[React SPA (port 3000)]  ←── HTTP/JSON ──→  [Express.js API (port 3001)]
      │                                              │
  Board.js (Dragula + state)                    server.js (REST endpoints)
  ├── Swimlane × 3 (ref containers)             ├── GET /api/v1/clients
  ├── Card × 20 (data-id attributes)            ├── GET /api/v1/clients/:id
  └── drake.cancel(true) reconciliation         └── PUT /api/v1/clients/:id
                                                      │
                                                 better-sqlite3 (clients.db)
```

The application follows a **decoupled client-server architecture** with separate dependency trees, build processes, and startup scripts. The React SPA runs on port 3000 via Create React App, while the Express API runs on port 3001 with babel-watch for hot-reloading.

## Dragula-React Cancel-and-Reconcile Pattern

### The Fundamental Problem

Dragula is an imperative DOM manipulation library — when a user drops an element, Dragula physically moves the DOM node from one container to another. React, however, expects to be the sole authority over the DOM via virtual DOM reconciliation. If Dragula moves a node without React's knowledge, the virtual DOM and actual DOM diverge, causing rendering corruption.

### The Solution: Cancel → Extract → Reconcile

**Step 1 — Container Registration** (constructor + `componentDidMount`):

```javascript
// Create stable refs for Dragula container identification
this.swimlanes = {
    backlog: React.createRef(),
    inProgress: React.createRef(),
    complete: React.createRef(),
};

// Register refs as Dragula drop containers
this.drake = Dragula([
    this.swimlanes.backlog.current,
    this.swimlanes.inProgress.current,
    this.swimlanes.complete.current,
]);
this.drake.on('drop', (el, target, source, sibling) => this.updateClient(...));
```

**Step 2 — Drop Event Handling** (`updateClient`):

```javascript
// IMMEDIATELY revert all DOM mutations Dragula made
this.drake.cancel(true);  // true = revert to original source position

// Identify target via ref identity comparison (not className or id)
let targetSwimlane = 'backlog';
if (target === this.swimlanes.inProgress.current) targetSwimlane = 'in-progress';
else if (target === this.swimlanes.complete.current) targetSwimlane = 'complete';

// Bridge from DOM to React state via data-id attribute
const clientThatMoved = clientsList.find(c => c.id === el.dataset.id);
const clone = { ...clientThatMoved, status: targetSwimlane };

// Sibling-relative insertion: find drop position from sibling element
const updatedClients = clientsList.filter(c => c.id !== clone.id);
const index = updatedClients.findIndex(c => sibling && c.id === sibling.dataset.id);
updatedClients.splice(index === -1 ? updatedClients.length : index, 0, clone);

// Let React's virtual DOM re-render from the authoritative state
this.setState({ clients: { backlog: ..., inProgress: ..., complete: ... } });
```

**Step 3 — Cleanup** (`componentWillUnmount`): `this.drake.remove()` destroys the Dragula instance and event listeners.

### Key Technical Details

| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| **`drake.cancel(true)`** | Reverts DOM node to original source position | Ensures Dragula's mutations are fully undone before React re-renders |
| **Ref identity comparison** | `target === this.swimlanes.*.current` | Reliable container identification via stable DOM node references |
| **Data-attribute bridge** | `el.dataset.id` ↔ `client.id` | Maps Dragula's DOM elements to React state objects |
| **Sibling-relative insertion** | `Array.findIndex(sibling) → Array.splice(index)` | Preserves exact drop position; `-1` fallback appends to end |

## Component Architecture

```
App (class) ─── manages selectedTab state
 ├── Navigation (class) ─── Bootstrap nav-tabs, ARIA attributes, onClick callback
 └── [Conditional: switch(selectedTab)]
       ├── HomeTab (functional) ─── animated circle with cubic-bezier transition
       └── Board (class) ─── owns all client state + Dragula lifecycle
              ├── Swimlane "Backlog" (class) ─── grey cards, dragulaRef
              ├── Swimlane "In Progress" (class) ─── blue cards, dragulaRef
              └── Swimlane "Complete" (class) ─── green cards, dragulaRef
                    └── Card × N (class) ─── data-id, data-status, color-coded
```

**State management**: Pure React component-local state — no Redux, Context API, or external stores. `App.state.selectedTab` controls navigation; `Board.state.clients` (partitioned into `backlog`, `inProgress`, `complete` arrays) is the authoritative data source. The 3-level component tree (Board → Swimlane → Card) is shallow enough that prop drilling is appropriate.

**Card rendering**: Each Card renders `data-id` and `data-status` as HTML data attributes on its root element, which the Board's drop handler reads via `el.dataset.*` — this is the bridge between Dragula's DOM-centric world and React's state-centric world. Cards are color-coded by status: grey (`rgba(167,158,158,0.671)`) for Backlog, sky blue for In Progress, muted green (`rgb(150,190,150)`) for Complete.

## Express.js REST API

### Endpoints

| Method | Endpoint | Key Features |
|--------|----------|-------------|
| `GET` | `/api/v1/clients` | Optional `?status=` filter, parameterized SQL, 3-value validation |
| `GET` | `/api/v1/clients/:id` | `parseInt` + existence check via `validateId()` |
| `PUT` | `/api/v1/clients/:id` | Fractional-priority insertion with batch reordering |

### Fractional-Priority Insertion Algorithm

The PUT endpoint implements a three-case reordering algorithm for maintaining contiguous integer priorities:

**Case 1 — No-op**: Same status and same priority → zero database writes.

**Case 2 — Intra-swimlane reorder**: Same status, different priority:

```
Given: [A:1, B:2, C:3, D:4], move D to position 2
1. Set D.priority = 2 - 0.5 = 1.5         // Fractional insertion
2. Sort by priority: [A:1, D:1.5, B:2, C:3]
3. Renumber: [A:1, D:2, B:3, C:4]          // Restore contiguous integers
```

**Case 3 — Cross-swimlane move**: Different status. The client is removed from its old status group and inserted into the new one using the same `priority - 0.5` fractional technique. Both old and new groups are independently renumbered. If no priority is specified, `Number.MAX_SAFE_INTEGER` places the item at the bottom.

### Database Layer

- **Engine**: SQLite via `better-sqlite3` (synchronous, zero-config embedded database)
- **Schema**: `clients(id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT, priority INTEGER)`
- **Seed data**: 20 client records — 11 Backlog, 5 In Progress, 4 Complete
- **Security**: All queries use parameterized bindings (`?` placeholders) for SQL injection protection
- **Connection**: Single persistent connection opened at module load; graceful shutdown on `SIGTERM`/`SIGINT` via `db.close()`

### Error Response Format

```json
{ "message": "Client not found", "long_message": "No client with ID 99 exists in the database" }
```

Structured dual-message format with short UI-friendly messages and longer developer-focused debugging information.

## Frontend Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| React | 16.7 | Class components (pre-hooks era) |
| Dragula | 3.7 | Imperative drag-and-drop |
| Bootstrap | 4.2 | Grid layout (`col-md-4`), nav-tabs |
| Create React App | 2.1 | Webpack/Babel build toolchain |

**Swimlane layout**: Bootstrap responsive grid (`container-fluid` → `row` → `col-md-4` × 3) with each swimlane column at `height: calc(100vh - 100px)` and `overflow-y: auto` for vertical scrolling.

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/Shiptivitas_Demo.gif" title="Shiptivitas Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

JavaScript (ES6+), React (16.7), Dragula (3.7), Bootstrap (4.2), Express (4.16), better-sqlite3 (5.4), Babel 7 (babel-watch), Create React App, Node.js (11.10)

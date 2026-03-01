---
layout: page
title: "GapBuffer: Header-Only C++17 Text Editor Data Structure"
description: "A simple C++ text editor that efficiently moves its cursor, accesses different positions, adds and removes characters, and edits texts"
importance: 19
category: "Web & App Development"
github: https://github.com/taivu1998/GapBuffer
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/GapBuffer)

## Overview

GapBuffer is a **header-only, fully-templated C++17 implementation** of the gap buffer data structure — the foundational text-editor buffer used historically by Emacs. The core innovation is maintaining a **contiguous internal gap** at the cursor position, making insertions and deletions at the cursor **O(1) amortized** while preserving O(1) random access via transparent index translation. The implementation features a **random-access iterator** (`GapBufferIterator<T>`) that satisfies `std::sort` requirements, complete **Rule-of-Five** compliance with timing-validated move semantics (<10 microseconds for 10,000-element moves), the **Scott Meyers const-cast idiom** for DRY const/non-const overloads, STL-compatible type aliases and comparison operators, and a **2x doubling reallocation strategy** with two-phase element transfer. The 41-test Qt Test harness covers edge cases including pathological self-assignment chains (`(buf = buf = buf) = buf`), nested `GapBuffer<GapBuffer<int>>` containers, and `std::sort` compatibility verification.

## Gap Buffer: Physical Memory Layout

```
[ element_0 ... element_{cursor-1} | GAP_SLOTS | element_{cursor} ... element_{n-1} ]
  ^─── pre-cursor content ─────^    ^── gap ──^   ^─── post-cursor content ─────^
```

Five member variables track the buffer state:

| Field | Type | Invariant |
|-------|------|-----------|
| `_logical_size` | `size_t` | Number of actual elements (excludes gap) |
| `_buffer_size` | `size_t` | Total allocated capacity (includes gap) |
| `_cursor_index` | `size_t` | Array index where the gap starts |
| `_gap_size` | `size_t` | Number of unused slots in the gap |
| `_elems` | `T*` | Raw pointer to the underlying array |

**Fundamental invariant**: `_buffer_size == _logical_size + _gap_size` must always hold.

## Core Operations

### O(1) Amortized Insertion at Cursor

```cpp
void insert_at_cursor(const_reference element) {
    if (_gap_size == 0) reserve(2 * _buffer_size);  // 2x doubling
    _elems[_cursor_index++] = element;
    ++_logical_size;
    --_gap_size;
}
```

The element is placed directly into the gap slot at `_cursor_index`. When the gap is exhausted, the buffer doubles in size. An **rvalue overload** uses `std::move(element)` to avoid copying expensive types (e.g., `GapBuffer<std::vector<int>>`).

### O(1) Deletion at Cursor (Backspace Semantics)

```cpp
void delete_at_cursor() {
    if (_cursor_index > 0) {
        --_cursor_index;
        --_logical_size;
        ++_gap_size;
    }
}
```

No data is physically moved — the cursor retreats one position, growing the gap to "absorb" the element. Deletion at position 0 is a safe no-op.

### O(|delta|) Cursor Movement

```cpp
void move_cursor(int delta) {
    if (delta > 0) {
        // Moving right: shift elements from after gap to before gap
        std::move(begin_after_gap, begin_after_gap + delta, cursor_position);
    } else {
        // Moving left: shift elements from before gap to after gap
        std::move(cursor_position + delta, cursor_position, destination_after_gap);
    }
    _cursor_index += delta;
}
```

Moving the cursor by `delta` positions requires physically relocating `|delta|` elements across the gap boundary via `std::move`. This is **O(|delta|)** — proportional to the distance moved, not the total buffer size. This matches text editor access patterns where edits are localized.

## Transparent Index Translation

The gap is invisible to external users. Two private helpers translate between logical (external) and physical (array) indices:

```cpp
size_type to_array_index(size_type external_index) const {
    if (external_index < _cursor_index) return external_index;        // Before gap: identity
    else return external_index + _gap_size;                           // After gap: skip gap
}

size_type to_external_index(size_type array_index) const {
    if (array_index < _cursor_index) return array_index;              // Before gap: identity
    else if (array_index >= _cursor_index + _gap_size)
        return array_index - _gap_size;                               // After gap: subtract gap
    else throw std::string("Inside gap: invalid");
}
```

## Memory Management: 2x Doubling Reallocation

```cpp
void reserve(size_type new_size) {
    if (_logical_size >= new_size) return;              // No shrinking
    auto new_elems = new T[new_size];
    std::move(_elems, _elems + _cursor_index, new_elems);           // Phase 1: pre-gap
    size_t new_gap_size = new_size - _logical_size;
    std::move(_elems + _cursor_index + _gap_size,
              _elems + _buffer_size,
              new_elems + _cursor_index + new_gap_size);             // Phase 2: post-gap
    delete[] _elems;
    _elems = new_elems;
    _buffer_size = new_size;
    _gap_size = new_gap_size;
}
```

**Two-phase element transfer**: Pre-cursor elements are moved first, then post-cursor elements are repositioned after the enlarged gap. The old array is `delete[]`'d only after the new one is fully populated — if `new` throws, `_elems` still points to valid data. Uses `std::move` for element transfer, avoiding unnecessary copies of complex types.

## Rule-of-Five: Complete Value Semantics

| Constructor/Operator | Behavior |
|---------------------|----------|
| `GapBuffer()` | Default: 10-slot buffer (`kDefaultSize`), entire buffer is gap |
| `GapBuffer(count, val)` | Fill: allocates `2*count` slots, fills `count` elements |
| `GapBuffer(initializer_list)` | Delegates to fill, then copies from initializer |
| `GapBuffer(const GapBuffer&)` | Deep copy: new array, copies all elements |
| `GapBuffer(GapBuffer&&)` | Pointer steal, nullifies source (`other._elems = nullptr`) |
| `operator=(const GapBuffer&)` | Deep copy assignment with self-assignment check |
| `operator=(GapBuffer&&)` | Move assignment with self-assignment check |
| `~GapBuffer()` | `delete[] _elems` |

## Scott Meyers Const-Cast Idiom

Non-const access methods delegate to their const counterparts to avoid code duplication:

```cpp
reference get_at_cursor() {
    return const_cast<reference>(
        static_cast<const GapBuffer*>(this)->get_at_cursor()
    );
}
```

This pattern appears in `get_at_cursor()`, `at()`, and `operator[]`.

## Random-Access Iterator

`GapBufferIterator<T>` stores a pointer to the owning `GapBuffer` and a **logical index** (not array index). Dereferencing calls `_pointee->at(_index)`, which handles gap translation transparently.

| Category | Operations |
|----------|-----------|
| **Dereference** | `operator*()` → `_pointee->at(_index)` |
| **Increment/Decrement** | `++`, `--` (pre and post) |
| **Random access** | `+=`, `-=`, `+`, `-` (iterator arithmetic) |
| **Difference** | `iter - iter` → `difference_type` |
| **Comparison** | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| **Subscript** | `operator[](n)` → `*(*this + n)` |

The constructor is **private** — only `GapBuffer<T>` (declared `friend`) can create iterators. Users obtain them via `begin()`, `end()`, or `cursor()` (a gap-buffer-specific method returning an iterator at the cursor position).

### STL Compatibility

The iterator satisfies random-access iterator requirements, verified by `std::sort` compatibility in the test suite (TEST5F).

## STL-Compatible Operator Overloads

| Operator | Implementation |
|----------|---------------|
| `operator<<` | `{elem1, elem2, ^elem3, ...}` with `^` marking cursor position |
| `operator==` / `!=` | Element-wise via `std::equal` |
| `operator<` / `>` / `<=` / `>=` | Lexicographic via `std::lexicographical_compare` |

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|:----------:|-------|
| `insert_at_cursor` | **O(1) amortized** | O(n) worst-case during reallocation |
| `delete_at_cursor` | **O(1)** | Index adjustment only |
| `move_cursor(delta)` | **O(\|delta\|)** | Physical element transfer across gap |
| `at(pos)` / `operator[]` | **O(1)** | Index translation + array access |
| `reserve(new_size)` | **O(n)** | Two-phase element move |
| Move constructor | **O(1)** | Pointer steal (verified <10 us for 10K elements) |
| Copy constructor | **O(n)** | Deep copy |

### Why Gap Buffers Excel for Text Editing

| Aspect | Gap Buffer | Rope | Piece Table |
|--------|:----------:|:----:|:-----------:|
| Insert at cursor | **O(1) amortized** | O(log n) | O(1) append |
| Delete at cursor | **O(1)** | O(log n) | O(k) split |
| Random access | **O(1)** | O(log n) | O(k) pieces |
| Cache locality | **Contiguous** | Fragmented | Fragmented |
| Move cursor by k | O(k) | O(log n) | O(1) |
| Implementation | **~500 lines** | Thousands | Hundreds |

The gap buffer is optimal when edits are **strongly localized** (typing, backspacing, small cursor movements) — exactly the dominant pattern in text editors.

## Test Suite (41 Qt Test Cases)

| Part | Tests | Coverage |
|------|:-----:|---------|
| **Part 1: Basic Ops** | 11 | Insert, delete, move_cursor, reserve, 10K-element stress test |
| **Part 2: Const** | 1 | Mutable vs. const reference semantics |
| **Part 3: Operators** | 10 | Fill constructor, `operator[]`, `operator<<`, `==`/`!=`, lexicographic `<`/`>` |
| **Part 5: Iterators** | 6 | Range-based for, bidirectional, random-access arithmetic, **`std::sort` compatibility** |
| **Part 6: Copy** | 6 | Initializer list, deep copy, **pathological self-assignment chains** |
| **Part 7: Move** | 8 | Move constructor/assignment, **timing tests (<10 us)**, rvalue insert, `GapBuffer<GapBuffer<int>>` nesting |

Edge cases tested: empty buffer ops, single-element buffers, deletion at position 0 (no-op), reserve smaller than logical size (no-op), self-assignment (`buf = buf`), chained self-assignment (`(buf = buf = buf) = buf`), self-move-assignment, nested containers (`GapBuffer<std::vector<int>>`, `GapBuffer<GapBuffer<int>>`).

## Tech Stack

C++17, Qt (qmake build system), Qt Test (QTest framework), STL (`std::move`, `std::equal`, `std::lexicographical_compare`, `std::fill`, `std::initializer_list`)

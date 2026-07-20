# Plan: New Variable System - Complete Rewrite

## Overview

- **Branch:** `feat/new-variable-system` (merged to master)
- **Breaking Change:** `set` telah dihapus sepenuhnya, digantikan dengan sistem baru
- **Goal:** Implementasi sistem variabel modern gaya Go/Python/JS
- **Status:** ✅ IMPLEMENTED

---

## Operator Summary

| Operator | Purpose | Example | Status |
|----------|---------|---------|--------|
| `:=` | Declaration (block-scoped) | `{{ x := 100 }}` | ✅ Done |
| `=` | Reassignment (must exist) | `{{ x = 200 }}` | ✅ Done |
| `:=` in expr | Walrus/inline assignment | `{{ if (d := fn()) > 0 }}` | ✅ Done |
| `\|\|=`, `&&=`, `??=`, `**=`, `//=` | Compound assignment | `{{ x \|\|= default }}` | ✅ Done |
| `define` | Block capture | `{% define name %}...{% enddefine %}` | ✅ Done (basic, no params) |

---

## Implemented Features

### 1. Variable Declaration (:=)

```nunjucks
{{ x := 100 }}              {# Basic declaration #}
{{ {a, b} := obj }}         {# Object destructuring #}
{{ [first, ...rest] := arr }}  {# Array destructuring with rest #}
{{ {a, b = 99} := obj }}    {# With defaults #}
{{ [a, , c] := arr }}        {# Holes in arrays #}
```

### 2. Variable Reassignment (=)

```nunjucks
{{ x := 1 }}    {# Declare first #}
{{ x = 2 }}     {# Reassign - must exist or throws ReferenceError #}
```

### 3. Compound Assignment

```nunjucks
{{ x \|\|= default }}   {# x = x \|\| default #}
{{ x &&= value }}       {# x = x && value #}
{{ x ??= default }}     {# x = x ?? default #}
{{ x **= 2 }}           {# x = x ** 2 #}
{{ x //= 2 }}           {# x = x // 2 (floor div) #}
```

### 4. Walrus Operator in Expressions

```nunjucks
{% if (d := user.discount) > 0 %}
  {{ d }}  {# Available in condition scope only #}
{% endif %}
```

### 5. Scope Isolation

Variables declared with `:=` are block-scoped:

```nunjucks
{{ x := 1 }}
{% if true %}{{ x := 2 }}{% endif %}
{{ x }}  {# Outputs: 1 - inner x does not leak #}
```

Works in: `if`, `for`, `switch`, `with` blocks.

### 6. Destructuring

#### Object Destructuring
```nunjucks
{{ {name, age} := user }}           {# Short-hand #}
{{ {a: x, b: y} := obj }}           {# With alias #}
{{ {a, ...rest} := obj }}            {# With rest #}
{{ {a, b = 99} := obj }}             {# With defaults #}
{{ {items: [first, second]} := obj }}  {# Nested #}
```

#### Array Destructuring
```nunjucks
{{ [first, second] := arr }}
{{ [a, ...rest] := arr }}
{{ [a, , c] := arr }}                {# Holes #}
{{ [a, b = 99] := arr }}            {# With defaults #}
{{ [a, {name}] := arr }}            {# Nested object #}
```

### 7. Define Block

Block capture syntax for macro-like behavior:

```nunjucks
{% define greeting %}Hello!{% enddefine %}
{{ greeting() }}  {# Outputs: Hello! #}
```

Note: `define` creates a simple macro without parameters. For parameterized macros, use `macro` instead.

---

## Files Changed

### Added
- `src/compiler/statement-compiler/variable.js` - Variable compilation
- `src/parser/statement-parser/variable.js` - Variable parsing

### Removed
- `src/compiler/statement-compiler/set.js`
- `src/parser/statement-parser/set.js`
- `src/parser/statement-parser/set.test.js`

### Modified
- `src/compiler/statement-compiler/index.js` - Export new functions
- `src/compiler/statement-compiler/output.js` - Handle variableDeclaration in output
- `src/compiler/statement-compiler/pattern.js` - Destructuring compilation
- `src/compiler/node-dispatch.js` - Dispatch for new node types
- `src/compiler/expression-compiler/inline.js` - Walrus operator handling
- `src/parser/expression-parser/inline.js` - `:=` detection in expressions
- `src/parser/expression-parser/primary.js` - Array/object pattern detection
- `src/parser/node-parsers/aggregate.js` - Holes and default values
- `src/parser/node-parsers/pattern.js` - Pattern parsing
- `src/parser/statement-parser/index.js` - Remove parseSet
- `src/parser/index.js` - Remove parseSet export
- `src/nodes/index.js` - New node types
- `src/runtime/frame.js` - Scope isolation fix
- `src/transformers/walk.js` - Walk new node types
- `src/core/destructuring.test.js` - Updated tests
- `src/core/scope-isolation.test.js` - New tests
- `src/core/with.test.js` - Updated to use new syntax

---

## Breaking Changes

| Old Syntax | New Syntax | Notes |
|------------|-----------|-------|
| `{% set x = 100 %}` | `{{ x := 100 }}` | Declaration uses `:=` |
| `{% set x := 100 %}` | `{{ x := 100 }}` | Walrus now IS `:=` |
| `{% set x %}{{ content }}{% endset %}` | `{% define x %}...{% enddefine %}` | Block capture (IMPLEMENTED) |
| Chained assignment | Multiple statements | No longer supported |

---

## Pending / Not Implemented

### 1. Tests for Compound Assignment
Compound assignment (`||=`, `&&=`, etc.) is implemented but has no dedicated test file.

### 2. Tests for Walrus in Expressions
Walrus operator in conditions is implemented but has limited test coverage.

### 3. Define with Parameters
`define` currently creates a simple macro without parameters. For parameterized macros, use `macro` instead.

---

## Implementation Order (Completed)

1. ✅ Phase 1: Lexer - `:=` token
2. ✅ Phase 2: Nodes - New node types (VARIABLE_DECLARATION, VARIABLE_ASSIGNMENT, COMPOUND_ASSIGNMENT)
3. ✅ Phase 3: Parser - Variable parsing + expression handling
4. ✅ Phase 4: Compiler - Variable compilation
5. ✅ Phase 5: Destructuring - Pattern compiler
6. ✅ Phase 6: Tests - Updated existing tests
7. ✅ Phase 7: Integration - Removed old `set` code

---

## Test Results

```
890 passing tests
0 failing tests
```

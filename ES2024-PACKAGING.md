# Nunjucks ES2024 Blazing Fast Package Restructuring Plan

> **Objective**: Transform nunjucks into a blazing fast ES2024-compliant monorepo with optimized packages.

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture](#current-architecture)
3. [Proposed Package Structure](#proposed-package-structure)
4. [ES2024 Optimization Spec](#es2024-optimization-spec)
5. [Implementation Phases](#implementation-phases)
6. [Package Specifications](#package-specifications)
7. [Migration Guide](#migration-guide)

---

## Overview

### Goals
- **ES2024 Minimum Standard**: All packages must use ES2024+ features
- **Blazing Fast Performance**: O(1) lookups, zero-copy operations, lazy evaluation
- **Type Safety**: TypeScript with strict mode across all packages
- **Monorepo**: npm workspaces for dependency management

### Non-Goals
- Breaking existing nunjucks API compatibility
- Changing template syntax (including `::` slice syntax)
- Supporting Node.js < 20.x

---

## Current Architecture

```
nunjucks/
├── src/
│   ├── nodes/           # AST node definitions (2 files)
│   ├── parser/          # Template parser (40+ files)
│   ├── transformers/    # AST transformers (12 files)
│   ├── compiler/        # Code generator (30+ files)
│   ├── runtime/         # Template runtime (22 files)
│   ├── filters/         # Built-in filters (10+ files)
│   ├── helpers/         # Utility functions
│   ├── config/          # Configuration
│   ├── core/            # Core rendering
│   ├── loaders/         # Template loaders
│   └── template/        # Template class
├── packages/@nunjucks/
│   ├── lexer/           # Lexer (TypeScript, exists)
│   ├── log/            # Logging (TypeScript, exists)
│   └── shared/         # Shared utilities (TypeScript, exists)
└── package.json        # Main package with workspaces
```

---

## Proposed Package Structure

```
packages/@nunjucks/
├── lexer/           # Lexical analysis (EXISTING - enhance ES2024)
├── log/            # Logging (EXISTING - maintain)
├── shared/         # Shared utilities (EXISTING - enhance)
├── nodes/          # NEW - AST node types (extract from src/nodes)
├── parser/         # NEW - Template parser (extract from src/parser)
├── transformers/   # NEW - AST transformers (extract from src/transformers)
├── compiler/       # NEW - Code generator (extract from src/compiler)
├── runtime/       # NEW - Template runtime (extract from src/runtime)
└── filters/       # NEW - Built-in filters (extract from src/filters)

src/
├── core/           # Core rendering (stays)
├── loaders/        # Loaders (stays)
├── template/       # Template class (stays)
├── config/         # Configuration (stays)
├── helpers/        # Helpers (stays)
├── integrations/   # Express integration (stays)
└── index.js        # Main export (stays)
```

---

## ES2024 Optimization Spec

### Performance Targets
| Metric | Target | Current |
|--------|--------|---------|
| AST node creation | < 1μs | ~5μs |
| Parse time (1KB template) | < 1ms | ~3ms |
| Compile time (1KB template) | < 2ms | ~5ms |
| Frame lookup | O(1) | O(n) parent chain |

### Required ES2024 Features

| Feature | Usage | Priority |
|---------|-------|----------|
| Symbol-based dispatch | Node type checks | REQUIRED |
| Object.groupBy() | groupby filter | REQUIRED |
| Array.toSorted() | sortby, dictsort filters | REQUIRED |
| Generator functions | Lazy AST traversal | REQUIRED |
| Template literals | Code generation | REQUIRED |
| Map/Set optimizations | Caching layers | REQUIRED |
| Iterative algorithms | Scope traversal | REQUIRED |
| Logical assignment | Compound operations | REQUIRED |
| Nullish coalescing | Safe property access | REQUIRED |
| Optional chaining | Property traversal | REQUIRED |

### Optimization Techniques

1. **Symbol-based O(1) Dispatch**: Replace `Object.values(NODE_TYPES).includes(n.type)` with Symbol-based type checks using Map lookup.

2. **FIELDS_CACHE**: Per-node-type field caching in a Map to avoid repeated `Object.keys()` calls.

3. **Lazy Iterators**: Generator-based AST traversal to avoid full tree copying.

4. **Single-Pass Transformers**: Combine multiple transform passes into one.

5. **Zero-Copy Context**: Persistent scope with toObject() caching.

6. **Map-based Caches**: O(1) lookups for frame variables, node constructors.

7. **Iterative Scope Walking**: Replace recursive scope traversal with iterative loops.

8. **Array.from() vs Spread**: Avoid iterator-to-array allocation overhead.

---

## Implementation Phases

### Phase 1: Foundation
**Status**: ✅ COMPLETE (855 tests pass)

- [x] Create plan document (`ES2024-PACKAGING.md`)
- [x] Extract `@nunjucks/nodes` package (TypeScript, 800+ lines - NEEDS OPTIMIZATION)
- [x] Extract `@nunjucks/parser` package (structure ready)
- [x] Update workspace dependencies
- [x] Verify tests pass

> **⚠️ ON HOLD**: `@nunjucks/nodes` package is too large (~800 lines). Needs optimization before proceeding.

### Phase 2: Processing Pipeline
**Status**: 🟡 ON HOLD

- [ ] Extract `@nunjucks/transformers` package
- [ ] Extract `@nunjucks/compiler` package
- [ ] Implement Symbol-based dispatch
- [ ] Implement single-pass transformers
- [ ] Verify tests pass

### Phase 3: Runtime
**Goal**: Extract and optimize runtime

- [ ] Extract `@nunjucks/runtime` package
- [ ] Extract `@nunjucks/filters` package
- [ ] Implement cached frame lookups
- [ ] Implement zero-copy context
- [ ] Verify tests pass

### Phase 4: Integration
**Goal**: Finalize monorepo structure

- [ ] Create `@nunjucks/core` meta-package
- [ ] Update main `nunjucks` package
- [ ] Update documentation
- [ ] Final test verification
- [ ] Benchmark verification

---

## Package Specifications

### @nunjucks/nodes

**Purpose**: Type-safe AST node definitions and factory functions

**Files**:
```
src/nodes/index.js → packages/@nunjucks/nodes/src/index.ts
```

**ES2024 Features**:
- Symbol-based node type constants
- FIELDS_CACHE with Map
- Lazy `findAll()` generator
- TypeScript interfaces for all nodes

**Exports**:
```typescript
export const NODE_TYPES: Readonly<Record<string, symbol>>;
export const nodes: Readonly<NunjucksNodes>;
export type Node = { type: symbol; lineno: number; colno: number; fields: string[] };
export type RootNode = Node & { children: Node[] };
// ... all node types
```

---

### @nunjucks/parser

**Purpose**: Template string parsing into AST

**Files**:
```
src/parser/*.js → packages/@nunjucks/parser/src/
```

**ES2024 Features**:
- Error cause chaining
- Array.findLast() for suffix operations
- Async/await for parsing
- Typed parser combinators

**Exports**:
```typescript
export function parse(template: string, extensions?: Extension[], opts?: ParseOptions): RootNode;
export { nodes } from '@nunjucks/nodes';
```

---

### @nunjucks/transformers

**Purpose**: AST transformations (pipe lifting, super handling, statement conversion)

**Files**:
```
src/transformers/*.js → packages/@nunjucks/transformers/src/
```

**ES2024 Features**:
- Lazy iterators (nodeIterator, filterNodes, findNode, countNodes)
- Single-pass transformAST()
- Map-based CONSTRUCTOR_MAP
- Generator-based traversal

**Exports**:
```typescript
export function transform(ast: RootNode, asyncPipes?: boolean): RootNode;
export function walk(ast: Node, func: WalkFunc, depthFirst?: boolean): Node;
export function nodeIterator(ast: Node): Generator<Node>;
export function filterNodes(ast: Node, predicate: Predicate): Generator<Node>;
export function findNode(ast: Node, predicate: Predicate): Node | undefined;
export function countNodes(ast: Node, predicate?: Predicate): number;
```

---

### @nunjucks/compiler

**Purpose**: AST to JavaScript code generation

**Files**:
```
src/compiler/*.js → packages/@nunjucks/compiler/src/
```

**ES2024 Features**:
- Template literal code generation
- Map-based emit dispatch
- Consolidated string building
- Source map generation

**Exports**:
```typescript
export function createCompiler(templateName: string, undefinedMode: string, source: string): Compiler;
export function compile(template: string, opts?: CompileOptions): CompiledTemplate;
export { transform } from '@nunjucks/transformers';
export { nodes } from '@nunjucks/nodes';
```

---

### @nunjucks/runtime

**Purpose**: Template execution runtime

**Files**:
```
src/runtime/*.js → packages/@nunjucks/runtime/src/
```

**ES2024 Features**:
- lookupCache for O(1) frame lookups
- Cached toObject() in render context
- Iterative scope traversal
- Symbol-based sandbox checks

**Exports**:
```typescript
export function createFrame(parent?: Frame): Frame;
export function createRenderContext(initialData?: object): RenderContext;
export function memberLookup(obj: object, key: string): any;
export function slice(arr: any[], start?: number, stop?: number, step?: number): any[];
export { createSafeString, isSafeString, markSafe } from './safe-string';
```

---

### @nunjucks/filters

**Purpose**: Built-in template filters

**Files**:
```
src/filters/*.js → packages/@nunjucks/filters/src/
```

**ES2024 Features**:
- Object.groupBy() for groupby
- Array.toSorted() for sorting
- Lazy filter chains

**Exports**:
```typescript
export function batch(arr: any[], size: number, fill?: any): any[];
export function dictsort(val: object, caseSensitive?: boolean, by?: string): [string, any][];
export function groupby(arr: any[], attr: string): Record<string, any[]>;
export function sortby(arr: any[], attr: string, reverse?: boolean): any[];
export function reverse(val: any): any;
export function length(val: any): number;
// ... all other filters
```

---

## Workspace Configuration

### Updated package.json (root)

```json
{
  "name": "nunjucks",
  "workspaces": [
    "packages/@nunjucks/lexer",
    "packages/@nunjucks/log",
    "packages/@nunjucks/shared",
    "packages/@nunjucks/nodes",
    "packages/@nunjucks/parser",
    "packages/@nunjucks/transformers",
    "packages/@nunjucks/compiler",
    "packages/@nunjucks/runtime",
    "packages/@nunjucks/filters"
  ]
}
```

### TypeScript Configuration

Each package requires:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "Preserve",
    "lib": ["ES2024"],
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

---

## Migration Guide

### For Package Consumers

1. **No API Changes**: All existing nunjucks API remains the same
2. **Optional Tree-Shaking**: Import specific packages for smaller bundles
3. **ES2024 Runtime Required**: Node.js 20.x or later

### For Contributors

1. Each package is independently versioned
2. Cross-package imports use workspace protocol
3. Tests run per-package and integration-level
4. ES2024 features required in all code

---

## Success Metrics

- [ ] All 855 tests pass after restructuring
- [ ] Package size reduction (tree-shaking enabled)
- [ ] Parse performance improvement (>50% faster)
- [ ] Compile performance improvement (>30% faster)
- [ ] Frame lookup O(1) vs O(n)
- [ ] Zero recursive algorithms in hot paths

---

## Appendix: ES2024 Feature Reference

| Feature | Specification | Node.js Support |
|---------|--------------|-----------------|
| Symbol keyed dispatch | [PR 495](https://github.com/nunjucks/nunjucks/pull/495) | 20.x+ |
| Object.groupBy | [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy) | 22.x+ |
| Array.toSorted | [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted) | 22.x+ |
| Generator functions | ES6 | 20.x+ |
| Iterator helpers | [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) | 20.x+ |
| Array fromAsync | [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync) | 22.x+ |

---

**Last Updated**: Phase 1 Start
**Status**: Planning Complete

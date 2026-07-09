# Nunjucks Composable Refactoring Plan

## Overview

This document outlines the comprehensive refactoring plan to transform Nunjucks into a fully composable architecture following 16 patterns from the Master Manifesto.

**Goals:**
- Split monolithic files (>500 lines) into focused modules
- Convert all code to pure functions where possible
- Eliminate side effects at module root level
- Create `tests/unit/` mirroring `src/` structure
- Remove backward compatibility (no legacy imports)

---

## Guiding Principles

| Principle | Application |
|-----------|-------------|
| **Pure Functions Only** | All extracted code: `f(ctx, args) → result` — no `this`, no closures, no mutation |
| **Context Object** | Parser/Compiler class state moved to explicit `ctx` object passed to functions |
| **Stop on Risk** | If complexity spikes or tests fail, revert and stop — don't force |
| **Tests After** | All unit tests written **after** refactoring passes |
| **Lowest Risk First** | Order: **Phase 1 (Error) → Phase 2 (Environment) → Phase 3 (Parser) → Phase 4 (Compiler)** |

---

## Current State Analysis

### Files Over 500 Lines (Must Split)

| File | Lines | Concepts Mixed |
|------|-------|---------------|
| `parser.js` | 1504 | parseFor, parseIf, parseSet, parseImport, parseInclude, parseMacros... |
| `compiler.js` | 1331 | compileFor, compileIf, compileMacro, compileInclude... |
| `environment.js` | 332 | loaders, filters, tests, globals, templates, error formatting |

### Files With Mutable State (Must Fix)

| File | Variable | Issue |
|------|----------|-------|
| `error/environment.js` | `_cachedFs`, `_defaultEnv` | lazy loading cache |
| `error/config.js` | `_config` | mutable config |
| `jinja-compat.js` | `let installed = false` | mutable singleton |

### Files Already Completed ✅

| File | Original Lines | New Structure |
|------|---------------|--------------|
| `transformer.js` | 241 | `transformers/` (7 files) |
| `lexer.js` | 508 | `lexer/` (4 files) |
| `runtime.js` | 458 | `runtime/` (7 files) |
| `filters.js` | 552 | `filters/` (5 files) |

---

## Target Architecture (Final)

```
nunjucks/src/
├── lexer/                    ✅ Complete (4 files)
├── filters/                  ✅ Complete (5 files)
├── runtime/                  ✅ Complete (7 files)
├── transformers/              ✅ Complete (7 files)
│
├── error/                    📋 Phase 1
│   ├── config.js             # Factory pattern
│   ├── environment.js        # Factory pattern
│   └── [existing structure]
│
├── environment/              📋 Phase 2
│   ├── environment.js        # Class shell (~200L)
│   ├── loader-utils.js      # Pure helpers
│   ├── filter-wrappers.js # Pure wrappers
│   ├── template-resolver.js # Pure resolvers
│   └── built-ins.js         # Init helpers
│
├── parser/                   📋 Phase 3
│   ├── parser.js            # Class shell (~200L)
│   ├── cursor.js            # Token cursor pure fns
│   ├── error.js             # fail/error pure fns
│   ├── statement-parser/    # parseFor, parseIf, etc.
│   ├── expression-parser/   # parseOr, parseAnd, etc.
│   ├── postfix-parser/      # parsePostfix, parseLookup
│   └── node-parsers/       # parseAggregate, parseSignature
│
├── compiler/                 📋 Phase 4
│   ├── compiler.js          # Class shell (~250L)
│   ├── context.js           # Compiler state pure fns
│   ├── emitters.js          # emit, emitLine pure fns
│   ├── statement-compiler/  # compileFor, compileIf, etc.
│   └── expression-compiler/  # compileLiteral, compileAdd, etc.
│
├── loaders/                  ✅ Complete (existing structure)
├── lib/                      ✅ Complete (existing structure)
├── context.js
├── template.js
├── nodes.js
├── object.js
├── globals.js
├── jinja-compat.js          # Factory pattern (Phase 1)
├── precompile.js
├── precompile-global.js
├── express-app.js
└── index.js
```

---

## Composable Patterns Applied

### Pure Functions
Functions with no side effects. Input same = Output same.

```js
// Before (mutable state)
let sym = 0;
const gensym = () => `__${sym++}`;

// After (pure with factory)
const createSymbolGenerator = (seed = 0) => {
  let counter = seed;
  return () => {
    const result = `__${counter++}`;
    return result;
  };
};
```

### Context Object Pattern
State passed explicitly, not via `this`.

```js
// Before (class method)
class Parser {
  parseExpression() {
    return this.parseInlineIf();
  }
}

// After (pure function with context)
export const parseExpression = (ctx) => parseInlineIf(ctx);
```

### Factory Functions
Create objects without `new`, flexible with mixins.

```js
export const createConfigStore = (initial) => {
  let state = { ...initial };
  return {
    get: () => ({ ...state }),
    set: (opts) => { state = { ...state, ...opts }; }
  };
};
```

---

## Rules Summary

### Tree Shaking & Side Effects
- ✅ ES Modules static imports only
- ✅ No side effects at module root
- ✅ Side effects encapsulated in functions
- ✅ Lazy evaluation where needed

### Naming Conventions
- ❌ No generic names: utils.js, helper.js, manager.js
- ❌ No redundant naming: cart/cartShipping.js
- ✅ One concept per file
- ✅ Namespace is folder, not filename prefix

### Size Limits
- Files: 200-500 lines max
- Functions: 10-50 lines max

---

## Implementation Phases

### Phase 1: Error Module (Low Risk) 🟢

**Why Low Risk:**
- 24 files already well-structured
- Only need to encapsulate 3 mutable state patterns
- No core compilation logic involved

**Files to MODIFY:**
- `error/config.js` — encapsulate mutable `_config`
- `error/environment.js` — encapsulate `_cachedFs`, `_defaultEnv`
- `jinja-compat.js` — encapsulate `installed`

**Files to DOCUMENT (no code change):**
- `error/formatters/html/styles.js` (413L) — CSS data, cannot split
- `error/constants/ide-links.js` (~450L) — Data constants

**Changes:**

```js
// error/config.js — Before
let _config = { ... };
export const getErrorConfig = () => ({ ..._config });
export const setErrorConfig = (options = {}) => { _config = {...} };

// error/config.js — After
export const createConfigStore = (initial) => {
  let state = { ...initial };
  return {
    get: () => ({ ...state }),
    set: (opts) => { state = { ...state, ...opts }; }
  };
};
export const errorConfig = createConfigStore({ ide: 'vscode', version: '3.2.4', csp: {...} });
```

```js
// error/environment.js — Before
let _defaultEnv = null;
export const getEnvironment = () => _defaultEnv ??= new Environment();

// error/environment.js — After
export const createErrorEnvironment = (options = {}) => new Environment(options);
export const getDefaultErrorEnvironment = () => createErrorEnvironment();
```

**Commit:** `refactor: extract error state to factories`

**Stop Criteria:**
- ❌ Stop if any test fails after refactor
- ❌ Stop if tree-shaking breaks
- ✅ Commit when all 378 tests pass

---

### Phase 2: Environment (Low Risk) 🟢

**Why Low Risk:**
- 332L class with clear method boundaries
- Helper functions already pure (just need extraction)
- No recursive dependencies

**Target File Structure:**
```
environment/
├── environment.js     # Environment class (~200L)
├── index.js          # re-exports
├── loader-utils.js    # 6 pure helpers
├── filter-wrappers.js # 2 pure wrappers
├── template-resolver.js # 3 methods
└── built-ins.js      # 3 init methods
```

**Pure Function Extractions:**

```js
// environment/loader-utils.js
export const isRelativePath = (loader, filename) => ...;
export const resolveTemplatePath = (loader, parentName, filename) => ...;
export const findCachedTemplate = (loaders, resolveFn, name, parentName) => ...;
export const normalizeIncludeChain = (includeChain) => ...;
export const resolveTemplateName = (name) => ...;
export const validateTemplateName = (name) => ...;

// environment/filter-wrappers.js
export const wrapFilterWithError = (filter, name) => ...;
export const wrapAsyncFilter = (filter, name) => ...;
```

**Class Becomes Delegate:**
```js
// environment/environment.js
import * as LoaderUtils from './loader-utils.js';
import { wrapFilterWithError, wrapAsyncFilter } from './filter-wrappers.js';

export class Environment extends EmitterObj {
  resolveTemplate(loader, parentName, filename) {
    return LoaderUtils.resolveTemplatePath(loader, parentName, filename);
  }
  // ... thin wrappers for other methods
}
```

**Commit:** `refactor: extract environment helpers to pure functions`

**Stop Criteria:**
- ❌ Stop if any test fails
- ❌ Stop if async flow breaks
- ✅ Commit when all 378 tests pass

---

### Phase 3: Parser (Medium Risk) 🟡

**Why Medium Risk:**
- 1504L, 56 methods, deep recursive call chain
- Must maintain token cursor semantics (peek/push)
- parseStatement → parseExpression → parsePrimary has stateful flow

**Target File Structure:**
```
parser/
├── parser.js           # Parser class shell (~200L)
├── cursor.js           # Token cursor pure functions
├── error.js            # fail(), error() pure functions
├── index.js
├── statement-parser/
│   ├── for.js          # parseFor(ctx)
│   ├── if.js           # parseIf(ctx)
│   ├── set.js
│   ├── block.js
│   ├── macro.js
│   ├── call.js
│   ├── import.js
│   ├── from.js
│   ├── include.js
│   ├── extends.js
│   ├── switch.js
│   ├── raw.js
│   ├── with.js
│   └── filter.js
├── expression-parser/
│   ├── index.js
│   ├── logical.js     # parseOr, parseAnd, parseNot
│   ├── nullish.js     # parseNullishCoalesce
│   ├── in.js          # parseIn
│   ├── is.js          # parseIs
│   ├── compare.js     # parseCompare
│   ├── concat.js      # parseConcat
│   ├── arithmetic.js   # parseAdd, parseSub, parseMul, parseDiv, etc.
│   ├── unary.js       # parseUnary, parseNeg, parsePos
│   ├── primary.js     # parsePrimary
│   └── inline.js      # parseInlineIf
├── postfix-parser/
│   ├── index.js
│   ├── fun-call.js
│   ├── lookup.js      # parseLookupVal (subscript, .attr)
│   ├── slice.js
│   ├── optional.js    # parseOptionalChain
│   └── pipe.js
└── node-parsers/
    ├── aggregate.js    # parseGroup, parseArray, parseDict
    ├── signature.js    # parseSignature
    └── pair.js
```

**Context Object Pattern:**

```js
// parser/cursor.js
export const createCursor = (tokens) => ({
  tokens,
  peeked: null,
  breakOnBlocks: null,
  dropLeadingWhitespace: false
});

export const nextToken = (ctx, withWhitespace) => { ... };
export const peekToken = (ctx) => { ... };
export const pushToken = (ctx, tok) => { ... };
export const skipSymbol = (ctx, val) => { ... };
```

**Migration Order (Lowest Risk Within Phase):**
1. **Step 3.1**: Extract `cursor.js` + `error.js` (pure utilities)
2. **Step 3.2**: Extract `node-parsers/` (leaf parsers)
3. **Step 3.3**: Extract `expression-parser/` (recurse bottom-up)
4. **Step 3.4**: Extract `postfix-parser/` (depends on expression-parser)
5. **Step 3.5**: Extract `statement-parser/` (depends on expression-parser)
6. **Step 3.6**: Replace Parser class body with delegation
7. **Step 3.7**: Delete `parser.js`

**Commit:** `refactor: extract parser to pure functions`

**Stop Criteria:**
- ❌ Stop if any test fails **at any step**
- ❌ Stop if 2+ consecutive step failures
- ❌ Stop if AST output differs
- ✅ Commit only when all 378 tests pass

---

### Phase 4: Compiler (High Risk) 🔴

**Why High Risk:**
- 1331L, 53 public + 26 private methods
- `compileFor` alone is 210L with nested closures
- Buffer state (`codebuf`, `bufferStack`, `_scopeClosers`) shared everywhere
- Source map tracking must remain consistent

**Target File Structure:**
```
compiler/
├── compiler.js          # Compiler class shell (~250L)
├── context.js           # createCompilerContext pure fn
├── emitters.js          # emit, emitLine, pushBuffer, etc.
├── index.js
├── statement-compiler/
│   ├── for.js           # compileFor (with sub-helpers)
│   ├── async-each.js    # compileAsyncEach + _compileAsyncEachLoop
│   ├── async-all.js     # compileAsyncAll + _compileAsyncAllLoop
│   ├── if.js
│   ├── set.js
│   ├── block.js
│   ├── macro.js
│   ├── caller.js
│   ├── import.js
│   ├── from-import.js
│   ├── include.js
│   ├── extends.js
│   ├── super.js
│   ├── switch.js
│   └── capture.js
├── expression-compiler/
│   ├── literals.js
│   ├── binary.js
│   ├── unary.js
│   ├── compare.js
│   ├── lookup.js
│   ├── fun-call.js
│   ├── pipe.js
│   ├── container.js     # compileArray, compileDict, compileGroup, compilePair
│   ├── inline.js
│   └── keyword-args.js
└── source-map-helper.js
```

**Context Object Pattern:**

```js
// compiler/context.js
export const createCompilerContext = (templateName, throwOnUndefined, source) => ({
  templateName,
  codebuf: [],
  lastId: 0,
  buffer: null,
  bufferStack: [],
  _scopeClosers: '',
  inBlock: false,
  throwOnUndefined,
  compiledLine: 0,
  sourceMap: new SourceMap(templateName)
});

// compiler/emitters.js
export const emit = (ctx, code) => ctx.codebuf.push(code);
export const emitLine = (ctx, code) => { /* ... */ };
export const pushBuffer = (ctx) => { /* ... */ };
export const popBuffer = (ctx) => { /* ... */ };
```

**Migration Order:**
1. **Step 4.1**: Extract `context.js` + `emitters.js` (foundations)
2. **Step 4.2**: Extract `expression-compiler/` (simpler than statements)
3. **Step 4.3**: Extract `statement-compiler/` (excluding for/async)
4. **Step 4.4**: Extract `statement-compiler/for.js` (most complex, last)
5. **Step 4.5**: Extract async variants
6. **Step 4.6**: Replace Compiler class body with delegation
7. **Step 4.7**: Delete `compiler.js`

**Snapshot Tests:**

```
tests/unit/compiler/
├── snapshots/
│   ├── basic.njk.snap
│   ├── for-loop.njk.snap
│   ├── if-else.njk.snap
│   ├── macros.njk.snap
│   ├── async-each.njk.snap
│   ├── extends.njk.snap
│   ├── include.njk.snap
│   └── source-maps.snap
└── snapshot.test.js
```

**Commit:** `refactor: extract compiler to pure functions with snapshot tests`

**Stop Criteria:**
- ❌ Stop at **first test failure**
- ❌ Stop if source map output differs
- ❌ Stop if generated code is not byte-equivalent
- ✅ Compare compiled output snapshots if needed (deterministic)

---

## Stop & Rollback Rules

| Trigger | Action |
|---------|--------|
| Any test fails (1 test) | Revert that step, don't proceed |
| 2+ consecutive step failures in same phase | Stop entire phase |
| Snapshot mismatch in Phase 4 | Stop immediately |
| 3+ tests fail after a step | Full phase revert |

**Pre-phase snapshot:**
```bash
git tag pre-phase-1  # Before each phase
git tag pre-phase-2
git tag pre-phase-3
git tag pre-phase-4
```

---

## Test Plan (Post-Refactor)

Tests are written **after** all refactoring phases complete:

```
tests/unit/
├── compiler/
│   ├── snapshots/          # Phase 4 snapshot tests
│   └── snapshot.test.js
├── parser/
│   ├── cursor.test.js
│   ├── statement-parser/
│   └── expression-parser/
├── environment/
│   ├── loader-utils.test.js
│   └── filter-wrappers.test.js
└── error/
    ├── config.test.js
    └── environment.test.js
```

---

## Summary

| Phase | Risk | Effort | Target |
|-------|------|--------|--------|
| 1. Error Module | 🟢 Low | 2-3h | Encapsulate mutable state |
| 2. Environment | 🟢 Low | 3-4h | Extract pure function helpers |
| 3. Parser | 🟡 Medium | 6-8h | Extract 56 methods to pure functions |
| 4. Compiler | 🔴 High | 8-10h | Extract 79 methods + snapshot tests |

**Total:** ~19-25 hours across 4 phases

**Order:** Phase 1 → 2 → 3 → 4 (lowest risk first)

**Rule:** Don't force success — if it breaks, revert and stop.

---

## Commit History

- `7684162` - refactor: split filters.js into modular folder structure
- `2b6c479` - refactor: split transformers, lexer, runtime into composable folders
- `9b4bf80` - refactor: add composable plan and initial improvements
- `c92c705` - feat(error): console hyperlink support with OSC 8 format

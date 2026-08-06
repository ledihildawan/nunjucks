# Refactoring Plan v2 — Clean Code / SOLID / FP / Co-location

## Baseline State (verified)
- **`any` usage:** ZERO across all 13 packages ✅
- **`unknown` usage:** Correct everywhere data is dynamic ✅
- **FP infra:** remeda, pipe helpers, `Object.freeze`/`readonly` in place ✅
- **Layering:** No back-imports (parser↛compiler, compiler↛core) ✅
- **Current gates:** typecheck PASS, 1228 tests PASS, lint PASS

---

## PHASE A — Type Safety: 2 Type-Guard Predicates
*Low risk, eliminates downstream `as` casts.*

| File | Current | Target |
|---|---|---|
| `runtime/src/safe-string.ts:23` `isSafeString` | `(val: unknown) => boolean` | `(val: unknown) => val is SafeString` |
| `runtime/src/context.ts:251` `isContext` | `(obj: unknown) => boolean` | `(obj: unknown) => obj is Context` |
| `core/src/template/runtime-context.ts:9` | Update `isSafeString` declaration to match predicate | Keep interface in sync |

**Eliminates `as` casts at:** `factory/core.ts:40,46`, `filters/string.ts:75`, `filters/array.ts:33`, `suppress-value.ts:100,109`

---

## PHASE B — FP/SOLID: Remove Mutation & Dead Code
*Mechanical, reduces line count.*

### B1. Construct-once in parser (use existing factory `fields` param)
| File | Pattern |
|---|---|
| `parser/src/statement-parser/if.ts:16-35` | Build `cond`/`body`/`else_` locals → `return if_(..., { cond, body, else_ })` |
| `parser/src/statement-parser/for.ts:10-62` | Same — including `parseForName` (stop mutating passed-in `node`) |
| `parser/src/statement-parser/block.ts:14-25` | Build `name`/`body` → `return block_(..., { name, body })` |
| `parser/src/expression-parser/index.ts:394-407,480-493` | `parseTernary`/`parseInlineIf` → construct once |

### B2. Dead exports (zero importers verified)
| File | Action |
|---|---|
| `nodes/src/factory.ts:353` | Remove `export` from `creators` and `nodes` (3-way exposure → 1) |
| `transformers/src/symbol.ts:3` | Drop `export` on `createSymbolGenerator` (internal only) |
| `parser/src/statement-parser/slots.ts:31` | Drop `export` on `parseSlotBlock` (internal only) |

---

## PHASE C — Comment Cleanup (final 6 items)
*Pure noise removal.*

| File:Line | Action |
|---|---|
| `log/src/render/internal/source-trace.ts:36` | REMOVE — `// Whether this is the line...` restates `isError` field |
| `log/src/render/internal/source-trace.ts:5` | REMOVE — comment restates `escapeForAlternation` |
| `log/src/render/internal/defaults.ts:1-2` | REMOVE — restates what `defaults.ts` obviously is |
| `log/src/render/internal/markdown.ts:4` | TRIM — drop first sentence, keep "Shared by text/ANSI" |
| `log/src/render/internal/source-trace.ts:76-79` | TRIM — keep first sentence only (rationale already at L12-16) |
| `compiler/src/statement-compiler/render.ts:24` | REMOVE — duplicates lines 14-15 |

---

## PHASE D — Test Co-location & Gaps

### D1. Create 4 Phase 4a unit tests (pure-logic, zero coverage today)
| New test file | Tests |
|---|---|
| `loaders/src/base.test.ts` | `createLoader()`, `isLoader()`, `LoaderSymbol` brand check |
| `transformers/src/symbol.test.ts` | `createSymbolGenerator` counter/uniqueness |
| `filters/src/attributes.test.ts` | `_prepareAttributeParts`, `getAttrGetter` dotted-path |
| `nodes/src/types/guards.test.ts` | `isNode` + 20 `is<T>()` predicates |

### D2. Add 6 codegen-behavior cases (assert-codegen style)
In `compiler/src/codegen-behavior.test.ts`, add `describe` blocks for: `component`, `exec`, `match`, `render`, `scope`, `slot`.

### D3. Fix co-location violations
| Move/Split | Reason |
|---|---|
| `core/src/scope.test.ts` → `core/src/integration/scope-tag.test.ts` | Tests `{% scope %}` tag via `render()`, no sibling source |
| `core/src/exec.test.ts` → `core/src/integration/exec-tag.test.ts` | Same — tests `{% exec %}` via `render()` |
| `core/src/scope-isolation.test.ts` → `core/src/integration/` | Same — behavior test, no sibling source |
| Split `runtime/src/security.test.ts` → `security/error.test.ts` + `security/scrubber.test.ts` | Currently barrel-test; `validator.ts` already has own test |
| Delete or trim `runtime/src/helpers.test.ts` | Redundant — sub-modules now have own `.test.ts` |

---

## PHASE E — Folder Naming Fixes
*Higher churn — do LAST, after tests pass, so renames don't conflict.*

### E1. Compiler/parser flat-vs-folder collision
| Current | Target | Rationale |
|---|---|---|
| `compiler/src/compile-statement.ts` | `compiler/src/statement-emitter.ts` | Contains scope/func lifecycle (`emitFuncBegin`), NOT per-node compile. Misleading name. |
| `compiler/src/compile-expression.ts` | Keep (or rename `expression-emitter.ts`) | Less misleading, lower priority |
| `parser/src/parse-nodes.ts` | `parser/src/parse-root.ts` | Top-level entry; stops colliding with `node-parsers/` folder |

### E2. Rename `test`-named source files (footgun)
| Current | Target |
|---|---|
| `lexer/src/test-definitions.ts` | `lexer/src/predicate-definitions.ts` |
| `runtime/src/builtin-tests.ts` | `runtime/src/builtin-predicates.ts` |

*(Update barrel re-exports: `lexer/src/index.ts`, `runtime/src/index.ts`)*

---

## Execution Order & Verification Gates

```
Phase A (type guards)  → typecheck + test
Phase B1 (parser mutation) → test (parser behavior coverage must still pass)
Phase B2 (dead exports) → typecheck (verify no broken imports)
Phase C (comments) → lint
Phase D1 (4 unit tests) → test count increases
Phase D2 (6 codegen cases) → test count increases
Phase D3 (co-location moves) → test (same count, new paths)
Phase E1-E2 (renames) → typecheck + test (do LAST)
FINAL GATE: typecheck + lint + test (≥ baseline)
```

**Estimated new test count:** 1228 → ~1290+ (4 unit + 6 codegen + split tests)

---

## What I will NOT do (YAGNI/KISS guards)
- ❌ Genericize `contextOrFrameLookup`/`lookup`/`fromIterator` (breaks test call sites)
- ❌ Touch the "risky trio" or `RuntimeContext` generic erasure (intentional dynamic dispatch)
- ❌ Add unit tests for emit/compiler files (covered by codegen-behavior)
- ❌ Force `internal/` convention repo-wide (lean: keep domain-grouped folders)
- ❌ Refactor `validators/expression.ts` path recursion (contained scratch mutation)
- ❌ Convert compiler buffer mutation (stateful codegen is its job)

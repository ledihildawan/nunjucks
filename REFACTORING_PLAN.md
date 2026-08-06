# Refactoring Plan — nunjucks

## Decisions (from clarifying answers)
- **Scope:** high-impact only (YAGNI: skip imperative-loop conversions that are already working)
- **`core ↔ filters`:** Dependency Injection — seam inside core (`core/src/filter-bundle.ts`)
- **Compiler `forEach` emit:** leave as-is (intrinsic to emit-based model)
- **Test:** per-file unit + behavior integration
- **Base:** on top of current working tree (`refactor/centralize-error-location` branch)
- **Slice dedup:** single implementation in `runtime/member-access.ts`

---

## PHASE 0 — Verification Gate (mandatory before anything)
1. Run `bun run typecheck && bun test` — record baseline (must pass without regression)
2. Note: `expression-compiler/test.ts` and `lexer/constants-tests.ts` are **source** modules (Nunjucks "test" expressions), NOT unit tests. Do not treat as test files.

---

## PHASE 1 — Type Safety: Generic Helpers + `unknown`→Guard

### 1a. Make helpers generic (preserve type, eliminate duplication)
| File | Current | Target |
|---|---|---|
| `runtime/src/member-access.ts:85` `slice` | `(arr: unknown[]\|string)…: unknown[]\|string` + C-style `for` loops | `<T>(arr: readonly T[] \| string, start, stop, step): T[] \| string`; replace loops with `R.range`/`map`. **Single source of truth** — this is the canonical implementation. |
| `runtime/src/member-access.ts:116` `nullishCoalesce` | `(left: unknown, right: unknown): unknown` | `<T>(left: T \| null \| undefined, right: T): T` |
| `runtime/src/helpers/runtime-helpers.ts:83` `lookup` | `defaultValue?: unknown): unknown` | `<T = unknown>(ctx, key, defaultValue?: T): T` |
| `runtime/src/helpers/runtime-helpers.ts:146` `fromIterator` | `(arr: unknown): unknown` (3 of 4 branches return unchanged) | `<T>(arr: T \| Iterable<T>): T \| T[]` |
| `runtime/src/helpers/runtime-helpers.ts:71` `contextOrFrameLookup` | `): unknown` | `<T = unknown>(…): T` |
| `filters/src/filters/string.ts:11` `fallback` | `(val: unknown, def: unknown)…: unknown` | `<T>(val: T \| null \| undefined, def: T, bool?): T` |

### 1b. `unknown` + `as` → typed structure / guard
| File | Issue | Target |
|---|---|---|
| `core/src/template/export-helpers.ts:11,13,19,20` | `parentFrame: unknown` → `as Pick<Frame,'push'>`, `ctx: unknown` → cast | Params: `Frame \| undefined` & `Record<string,unknown>` directly |
| `core/src/template/renderer-helpers.ts:15,16,24-29,31,36,42,50,55` | same pattern | Structure params; guard for error |
| `core/src/template/source-helpers.ts:15,34-42` | `_includeChain: unknown`, `src as TemplateSource` | Type `IncludeChain \| null`; custom `isCompiledTemplateExports` guard |
| `core/src/render-helpers.ts:17,42,53,75,88,99,103,109,127,137` | `context: unknown`, `loader: unknown` + many `as` | Params: `Record<string,unknown>`, structural `Loader` interface |
| `log/src/render/ansi/format-helpers.ts:62,83,89` | `error as ErrorLike` / `as { stack? }` **without guard** | Add/use `isErrorLike` guard, use narrowing |
| `runtime/src/context.ts:143` & `runtime/src/executor.ts:31,44` | 3× `as unknown as` (production escape hatch) | Investigate: typed `Block[]` & interface `RuntimeSelf` → eliminate double-cast |

### 1c. Shared `RuntimeSelf` interface
Currently every helper (`log-context.ts:10`, `suppress-value.ts`, `undefined-resolution.ts`, `runtime-helpers.ts`) receives `self: unknown` then `as { logContext? }`. Create one `RuntimeSelf` interface in `runtime/src/helpers/` and use consistently.

---

## PHASE 2 — Architecture: Break `core ↔ filters` Cycle via DI

**Problem:** `core/src/config/global.ts:1-5,135,160,198` imports `@nunjucks/filters` (source). Conversely, all `filters/*.test.ts:2` import `render` from `@nunjucks/core`.

**DI Solution:**
1. `core/src/config/global.ts` no longer imports `@nunjucks/filters`. `getDefaultConfig` accepts injection:
   ```ts
   getDefaultConfig(deps?: { filters?: FilterObject; sanitize?: Sanitizer; dompurify?: DomPurifyConfig })
   ```
   Default `{}` → `builtInFilters` = `Object.freeze({})`.
2. **Single explicit composition seam** `core/src/filter-bundle.ts` (NEW file — the ONLY file in core that imports `@nunjucks/filters`) → exports `defaultFilters`, `defaultSanitize`, `defaultDompurify`.
3. `render()` / core entry calls `getDefaultConfig(filterBundle)` when user doesn't supply config.
4. `core/src/config/index.ts:3` remove re-export of `DomPurifyConfig` from `@nunjucks/filters` — move type to `shared` so `core` has zero source dependency on `filters` even for types.

**Test edge `filters → core`** (filter tests need `render`): acceptable as integration tests. Optional: move to `core/src/integration/filter-features.test.ts` (already exists!).

---

## PHASE 3 — Self-barrel Import & Naming Collision

### 3a. Self-barrel → relative (prevent cycles)
- `runtime/src/executor.ts:1` `import … from '@nunjucks/runtime'` → relative `./context.ts`, `./frame.ts`, etc.
- `runtime/src/executor-runtime.ts:4` `import … from '@nunjucks/runtime'` → relative.

### 3b. Naming collision (source files named like tests)
| Current | Why Problematic | Target |
|---|---|---|
| `lexer/src/constants-tests.ts` (defines Nunjucks "test" categories: existence/boolean/…) | Name `*-tests.ts` → looks like a unit test file | `lexer/src/test-definitions.ts` (+ update import in `lexer/src/index.ts:54`) |
| `compiler/src/expression-compiler/test.ts` (compiles `is`/`is not` expressions) | Name `test.ts` → looks like unit test, collides with `*.test.ts` convention | `compiler/src/expression-compiler/test-expr.ts` (+ update import in `expression-compiler/index.ts`) |

---

## PHASE 4 — Test Co-location: Fill Gaps & Standardize

**Policy:** per-file unit tests for helper/pure logic; behavior/integration in `codegen-behavior.test.ts` (compiler) & `core/src/integration/`.

### 4a. Test gaps (tests were deleted during refactor, not replaced)
| File with no test | Action |
|---|---|
| `loaders/src/base.ts` | create `base.test.ts` |
| `transformers/src/symbol.ts` | create `symbol.test.ts` |
| `filters/src/attributes.ts` | create `attributes.test.ts` |
| `nodes/src/types/guards.ts` | create `guards.test.ts` |

### 4b. Compiler behavior tests
`codegen-behavior.test.ts` already exists & covers compile-node→assert-codegen. Ensure coverage for new statement results from refactor (`component`, `exec`, `match`, `render`, `scope`, `slot`) — add cases if missing.

### 4c. What NOT to do (YAGNI)
- Don't split `expression-compiler` into per-file unit tests (behavior already covered by `codegen-behavior.test.ts`).
- Don't add unit tests to all `statement-compiler/*` files (emit model = behavior, tested via codegen-behavior).

---

## PHASE 5 — Remove Unnecessary Comments (~15-25 lines)
| File:line | Action |
|---|---|
| `shared/src/errors/error-location.ts:1-50` | Cut 50-line markdown preamble → 3-4 lines or move to `docs/` |
| `runtime/src/context.ts:1-2` & `runtime/src/frame.ts:1-2` | Remove `// Import directly: …` headers (redundant with exports map) |
| `nodes/src/factory.ts:321-333` | Remove `// =====` banner + export-structure paragraph |
| `parser/src/statement-parser/slots.ts:34,45,91` | Remove comments that restate the code below |
| `runtime/src/component.ts:50-52` & `compiler/src/statement-compiler/component.ts:50-52` | Remove multi-line narration of `isPositional` branch |
| `shared/src/errors/error-location.ts:5` | Remove `// ## Precedence Order` markdown divider |

**Zero** commented-out code, TODO/FIXME, or license headers found — no action needed there.

---

## PHASE 6 — Final Verification Gate
1. `bun run typecheck` — must pass (generic & guard changes must not break call sites)
2. `bun run lint` (biome) — no new violations
3. `bun test` — must be ≥ Phase 0 baseline, no regressions
4. Manual check: no `import … from '@nunjucks/runtime'` inside `runtime/src/` (except test files)
5. Manual check: `grep -r "from '@nunjucks/filters'" packages/@nunjucks/core/src` must only appear in seam `filter-bundle.ts` (or zero if moved to integrations)

---

## What NOT to do (YAGNI / KISS / No Over-engineering)
- Imperative loop conversions in `lexer`/`parser` (state-threading is the correct model for tokenizer/parser)
- Compiler `forEach` side-effect emit (emit-based model is intrinsic)
- `string +=` in lexer loops (perf acceptable for template scale; regression risk > value)
- Pure-reduce refactor of `validators/expression.ts walk` (works, high regression risk)
- Force `export *` → explicit in all barrels (low value)

---

## Execution Order
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

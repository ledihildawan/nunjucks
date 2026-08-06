# REFACTORING_PLAN_V3 — Full Principles Sweep (Clean Code / SOLID / FP / Co-location)

## Baseline State (verified)
- **`any` usage:** ZERO across all 13 source packages ✅
- **`unknown` usage:** Correct everywhere data is dynamic ✅
- **FP infra:** No `class` anywhere; factory closures throughout; `Object.freeze`/`readonly`/`as const` on registries; COW tree traversal ✅
- **Layering:** DAG-shaped, no production cycles (one test-time cycle: filters→core→filters) ✅
- **Comment health:** No commented-out code, no TODO/FIXME/HACK debt ✅
- **Current gates:** typecheck PASS, 1241 tests PASS, lint PASS

---

## Phase F1 — Shared type-narrowing primitives
*Single source of truth for object/string/thenable narrowing. Removes ~15 casts.*

| Action | Detail |
|---|---|
| Promote → `shared/src/type-guards.ts` | `isRecord(x): x is Record<string, unknown>`, `isObject`, `readString`, `readNumber`, `readObject` (currently duplicated in `log/normalize.ts:34-53` + `runtime/security/validator.ts:7`) |
| Add `isThenable<T>(v): v is Promise<T>` | Replaces duplicated `val as { then?: unknown }` in `runtime/helpers/await-value.ts:2-3` + `suppress-value.ts:96-97` |
| Add `hasLogContext`, `isKeyedObject`, `isIterable` | Replaces ad-hoc casts in `log-context.ts:11-12`, `builtin-predicates.ts:68-69,91-92`, `runtime-helpers.ts:150-151` |
| Drop cosmetic generics (YAGNI) | `scrubber.ts` `<V>` → `unknown→unknown`; `createMacroFilter` `<T extends unknown[]>` → `(...args: unknown[])` |
| **Gate** | typecheck + test |

---

## Phase F2 — Token model + per-token guards (BIG)
*The single biggest cast cleanup (~40 sites).*

| Action | Detail |
|---|---|
| Add per-token-type guards | `isBlockEnd(tok): tok is Token & { value: string }`, etc. in `lexer/src/tokens.ts` or a new `lexer/src/token-guards.ts` |
| Replace `tok.value as string` | Across `parser/expression-parser/index.ts` (14 casts), `parser/cursor.ts:156,162,176,177`, `parser/expression-parser/postfix/pipe-forward.ts:15,18`, `parser/statement-parser/*.ts` (numerous) |
| Type the node factory creators | `SymbolNode.value: string` (currently `unknown`) → removes `n.value as string` in `compiler/statement-compiler/component.ts:27,33,35,41,47,57,98,129`, `variable.ts`, `pattern.ts`, `from-import.ts` |
| **Gate** | typecheck + parser + compiler tests |

---

## Phase F3 — `readonly` on AST node fields (mechanical, high-value)
*~40 fields verified never-mutated; lets compiler enforce intent.*

| Action | Detail |
|---|---|
| Add `readonly` to all node interfaces | `nodes/src/types/node-types.ts` lines 9-300: `children: readonly Node[]`, `body`, `value`, `left`, `right`, `args`, `target`, etc. |
| Verify COW still compiles | `nodes/src/traverse.ts` (`mapCOW`, `{ ...node, children }`) already immutable |
| Move misplaced imports | `nodes/src/factory.ts:320-321` imports buried at file bottom → top |
| **Gate** | typecheck + test |

---

## Phase F4 — Eliminate remaining `as` casts + real bugs

| File:Line | Issue | Fix |
|---|---|---|
| `compiler/src/index.ts:92` | `pop() as string \| null` silently drops `undefined` | Handle empty-stack case |
| `runtime/src/context.ts:142` | `as unknown as (...)` double-cast in block storage | Use `Array.isArray`; reconcile `blocks` typing |
| `runtime/src/executor.ts:16,32,45,57` | `as unknown as Record<...>` to set `_autoescape`/`blocks` | Add fields to `Context` interface |
| `parser/src/statement-parser/from.ts:93` | `withContext as boolean` lies if loop never ran | `withContext ?? false` |
| `core/src/render-helpers.ts:103` | `{ undefined: ... } as ParseOptions` | Widen `ParseOptions` / `compileToCode` param |
| `loaders/src/file-system.ts:176` | `createLoader() as FileSystemLoader` | Make `createLoader` generic |
| `lexer/src/tokens.ts:24` | `('float' as TokenType)` redundant | Drop cast |
| `shared/src/extract-blocks.ts:2` | Cast caused by bad param type `Record<string,unknown>\|object` | Fix param to `Record<string, unknown>` |
| Unify 6 "Error + lineno/extra" shapes | `core/template/error-helpers.ts:6` (`ErrorWithLineInfo`), `log/diagnostics.ts:25` (`ErrorWithCauses`), `log/render/to-text.ts:71`, `log/render/internal/error-parts.ts:11`, `log/render/to-html-helpers.ts` (`ErrorLike`) | One `TemplateError` extension in `@nunjucks/log` |
| Refactor `createLog` overload typing | Removes 6 `as Parameters<typeof createLog>[N]` sites (`parser/error.ts:53`, `core/render-helpers.ts:136,139`, `log/diagnostics.ts:145`) | Widen context param type |
| **Gate** | typecheck + test |

---

## Phase G1 — FP cleanups

| File:Line | Pattern | Fix |
|---|---|---|
| `runtime/component.ts:26` | `let args` with 3 conditional branches | `const` ternary |
| `runtime/component.ts:78` | 8-space indent defect | Re-indent |
| `log/src/create-log.ts:22` | `let normalized` | `const` ternary |
| `parser/statement-parser/match.ts:39,48` | `let pattern`, `let guard` | `const` + extract `parseOptionalGuard` |
| `parser/statement-parser/render.ts:16` | `let callExpr` | `const` ternary |
| `parser/statement-parser/slots.ts:35` | `let name = 'default'` | `const` on `nameTok?.type` |
| `parser/statement-parser/switch.ts:62` | `let defaultCase` | `const` ternary |
| `log/src/diagnostics.ts:145-150` | Post-create mutation of error | Fold fields into contextObj |
| `log/src/diagnostics.ts:41-53` | Copy-then-overwrite-with-undefined | Rest destructuring to omit |
| `core/src/template/error-helpers.ts:48-56,69-70` | Build-then-mutate Error | `Object.assign` one-shot |
| `core/src/render.ts:87-110` | Mutates `config` as scratch pad | Build immutable `resolvedConfig` |
| `compiler/statement-compiler/component.ts:11-24` | `forEach` with side effects | Pure partition (last-elem detection) |
| `shared/src/escaping/escape-context.ts:58-76` | `while(re.exec)` with `let` | `matchAll` |
| `filters/src/filters/array.ts:49,154` | `map(v => v)` no-op copy | `[...arr]` |
| `validators/src/template.ts:60-70` | Conditional `push` + redundant rebuild | `filter` + `as const` tuple |
| **Gate** | test |

---

## Phase G2 — SOLID parameter objects

| File | Issue | Fix |
|---|---|---|
| `compiler/statement-compiler/for.ts:50-58,75-83,109-117,131-139,164-172` | 5 helpers × 7 positional params | `interface LoopContext { ctx, nameNode, frame, arr, i, len, node }` (pattern already exists in sibling `pattern.ts: DestructuringContext`) |
| `log/src/diagnostics.ts:86-96,113-123` | 9-param `buildContextObj`/`buildMetadata` | `interface DiagnosticsBuildInput` |
| `shared/src/errors/error-location-matching.ts:106-244` | 6 funcs × 6 near-identical params | `interface MatchInput { content, errLineno, errColno, subject, preferredLine }` |
| `core/src/render.ts:48-55` | 6-param `executeCompiledTemplate` | Bundle `{ sandboxedCtx, context, warningsCollector, templateName }` into `ExecutionContext` |
| **SKIP** `runtime-helpers.ts:18` `callWrap` (8 params) | Codegen contract — positional call sites in emitted code | Leave as-is (documented exception) |
| **Gate** | typecheck + test |

---

## Phase H — Folder structure / file placement

| # | Action | Rationale |
|---|---|---|
| H1 | **Delete** `log/src/css-modules.d.ts` | CSS-module shim orphaned in a TS engine; no CSS imports anywhere |
| H2 | **Move** `transformers/src/symbol.ts` → `runtime/src/symbol-generator.ts` (or `shared/`) | String-id generator, not an AST transform; remove its `export *` from `transformers/index.ts` |
| H3 | **Move** `runtime/src/security.test.ts` → `runtime/src/security/index.test.ts` | Tests `./security/index.ts` but sits one level up |
| H4 | **Rename** `parser/parse-nodes.test.ts` → `parser/parse-root.test.ts` | Source is `parse-root.ts` (post-Phase E) |
| H5 | **Rename** `parser/node-parsers/` → `parser/node-parser/` | Sibling folders (`statement-parser/`, `expression-parser/`) are singular |
| H6 | **Split** `parser/expression-parser/index.ts` (491 lines) → `expression-parser.ts` + thin `index.ts` barrel | Implementation masquerading as barrel |
| H7 | **Split** `parser/statement-parser/index.ts` | Separate `STATEMENT_PARSERS` registry into its own file; barrel stays pure |
| H8 | **Move** `runtime/src/member-access.ts` → `runtime/src/helpers/member-access.ts` | `helpers/index.ts` already re-exports it; physical location mismatches logical home |
| H9 | **Fix subpath barrel bypasses** | `compiler/index.ts` (`@nunjucks/runtime/undefined`), `log/diagnostics.ts` (`@nunjucks/shared/error-location`), `runtime/sandbox/index.ts` (`@nunjucks/shared/blocked-keys`), `transformers/index.ts` (`@nunjucks/nodes/types`), `core/filter-bundle.ts` (`@nunjucks/filters/{string,array,...}`) → route through barrels |
| H10 | **Naming asymmetry** | Decide: `slots.ts`/`slot.ts` (singular everywhere) and `from.ts`/`from-import.ts` (align across parser+compiler) |
| H11 | **Move** `parser/src/error.ts` re-exports out of `cursor.ts:185` | Cursor re-exports `fail`/`EXPECTED_COLON_AFTER_DICT_KEY` from error module — surprising coupling |
| **Gate** | typecheck + test (do moves in dependency-safe order) |

---

## Phase I — Security-critical co-located tests
*Per your selection: security-critical files only; skip low-risk gaps.*

| New test file | Target |
|---|---|
| `validators/src/expression.test.ts` | `validateExpression`, `DEFAULT_SECURITY_CONFIG`, `ExpressionSecurityError` (expression sandboxing) |
| `shared/src/escaping/escape.test.ts` | HTML escaper (`escape.ts` — core security) |
| `shared/src/security/template-security.test.ts` | Template scanner |

**Fix barrel-test smell (import locally, not via package barrel):**
- `nodes/src/types/guards.test.ts` → `./guards.ts`
- `validators/src/config.test.ts` → `./config.ts`
- `validators/src/context.test.ts` → `./context.ts`
- (keep `runtime/src/index.test.ts` — it's a deliberate barrel contract test)

**Fix test-time cycle:** declare `@nunjucks/core` as devDependency in `filters/package.json` (5 filter test files import `render` from core).

| **Gate** | test count increases (3 new files) + cycle resolved |

---

## Phase J — Comment cleanup

| # | Action | Targets |
|---|---|---|
| J1 | **Remove** 9 file-header banners | `runtime/context.ts:1`, `runtime/frame.ts:1`, `runtime/sandbox/sandbox.ts:1`, `nodes/types/constants.ts:1`, `nodes/types/guards.ts:1`, `transformers/symbol.ts:2`, `transformers/super.ts:2`, `shared/index.ts:1` (keep 2-3), `shared/errors/error-location.ts:1` (keep L3) |
| J2 | **Remove** `nodes/factory.ts` duplicated export-block banners (lines 355-382) + compress in-body section banners | Strongest REMOVE candidate |
| J3 | **Remove** `runtime/builtin-predicates.ts` 10 category banners | `// Existence`, `// Boolean`, ... — entry names already convey category |
| J4 | **Remove** 6 inline WHAT comments | `parser/match.ts:19,37,47`, `parser/expression-parser/postfix/optional.ts:58,72`, `parser/statement-parser/render.ts:15` |
| J5 | **TRIM** banners keeping rationale kernel | `runtime/safe-string.ts:1` (drop line 1, keep 2-3 — why it extends `String`), `runtime/slots.ts:1` (drop line 1, keep 2-11 — precedence + Vue/Svelte rationale), `runtime/component.ts:1-2` (drop `// COMPONENT -` prefix) |
| **Gate** | lint |

---

## Execution Order & Verification Gates

```
F1 (shared guards)      → typecheck + test
F2 (token narrowing)    → typecheck + parser/compiler tests   [BIGGEST]
F3 (readonly nodes)     → typecheck + test                    [mechanical]
F4 (remaining casts)    → typecheck + test
G1 (FP cleanups)        → test
G2 (param objects)      → typecheck + test
H  (folder moves)       → typecheck + test                    [do LAST before tests]
I  (security tests)     → test count +3, cycle fixed
J  (comments)           → lint                                [LAST — zero behavior risk]
FINAL GATE: typecheck + lint + test (≥ 1244 baseline)
```

---

## What I will NOT do (YAGNI/KISS guards)
- ❌ Add tests for low-risk untested files (`log/render/ansi/`, `core/template/`, `compiler` emitters) — covered indirectly by integration tests; security-critical files only per your selection
- ❌ Convert compiler buffer mutation — stateful codegen is its job
- ❌ Touch `RuntimeContext` generic erasure — intentional dynamic dispatch
- ❌ Genericize `contextOrFrameLookup`/`lookup`/`fromIterator` — breaks test call sites
- ❌ Refactor `validators/expression.ts` path recursion — contained scratch mutation
- ❌ Force `internal/` convention repo-wide — lean domain-grouped folders
- ❌ Touch `callWrap` 8-param signature — codegen contract

---

**Estimated impact:**
- ~50 `as` casts removed
- ~40 `readonly` fields added
- ~25 comments removed/trimmed
- 3 new security test files (+~30-50 tests)
- 1 file deleted, ~7 files moved/renamed, 2 god-files split
- Test-time dependency cycle resolved

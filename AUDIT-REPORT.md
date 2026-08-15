# Audit Report — `packages/` + `samples/`

**Date:** 2026-08-13
**Ruleset:** Universal System Architecture & AI Agent Coding Guidelines (§1–§11)
**Scope:** All 16 `@nunjucks/*` packages + `samples/express` + `samples/vanilla-ts`

---

## Baseline (pre-existing errors)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | **CLEAN** — 0 errors |
| Lint | `bun run lint` (`biome lint packages samples`) | **CLEAN** — 609 files, 0 issues |
| Tests | `bun test` | **CLEAN** — 2676 pass / 0 fail (5051 expect calls) |

**No pre-existing errors.** All findings below are rule-compliance gaps, not breakage.

---

## Scope

| Area | Source files scanned |
|---|---|
| 16 `@nunjucks/*` packages (`lib, shared, error-catalog, error-renderer, error-formatter, nodes, lexer, parser, transformers, compiler, runtime, filters, core, loaders, validators, integrations`) | ~389 |
| `samples/express` + `samples/vanilla-ts` | 22 |
| **Total** | **~411 non-test `.ts` files** |

> Note: `packages/@nunjucks/log` is listed in `package.json` workspaces but has **no source directory** — only a built copy in `node_modules`. Stale workspace entry.

---

## Severity Roll-up

| Severity | Count | Character |
|---|---|---|
| CRITICAL | **0** | — |
| HIGH | **11** | All in `compiler` §10 (one systemic issue) |
| MEDIUM | **14** | Dead code, unsafe casts, layering smells |
| LOW | **~65** | Mostly safe casts + style nits |

**Codebase-wide strengths:** zero `any` across ~411 files; acyclic import graph matching every `package.json`; no for/while/forEach in domain core (all loops are in documented hot-path/stream exemptions); `new Function` isolated to one audited boundary (`code-loader.ts`); path-traversal defended (realpath + null-byte + symlink checks, tested with real fs); sandbox blocks `__proto__`/`constructor`/`prototype`; HTML escaping consistent in error-renderer; tests use real components + real temp files, not mocking frameworks.

---

## HIGH (11) — Compiler §10: unescaped identifier interpolation into generated JS

**Systemic issue, single root cause.** Template-derived identifiers (block names, loop var names, import aliases, capture names, scope keys) are interpolated directly into generated JS source as string literals (`"${name}"`) and as bare identifiers (`b_${name}`). The lexer's `DELIM_CHARS` does **not** include `"`, `'`, `;`, `\`, `$` — so a symbol token *could* carry those characters to the compiler. The compiler emits them without `JSON.stringify` or identifier validation.

**Exploitability (empirically verified):** **NOT currently exploitable.** Injection probes were run (`{% block a"b %}`, `{% set x"=1 %}`, `{% for a";evil() in items %}`, etc.) — **all are rejected** by the parser/validator layer (`PARSER_ERR`/`RENDER_ERR`) before reaching the compiler. The compiler currently relies on this upstream guarantee. This is therefore a **defense-in-depth gap**, not a live vulnerability: per §10 the codegen boundary must not depend on upstream behavior.

The already-correct pattern (`JSON.stringify`) exists at `fun-call.ts:94`, `lookup.ts:61`, `root.ts:93`, and throughout `component.ts`. The gap is the legacy `"${name}"` / `b_${name}` sites.

Affected sites (compiler):

| # | Site | Pattern |
|---|---|---|
| 1 | `statement-compiler/block.ts:12,25,27` | `getBloc("${name}")`, `b_${name}`, `frame.set({name:"${id}"})` |
| 2 | `statement-compiler/root.ts:49,72,85,86` | `getBlock("${name}")`, `emitFuncBegin(...,b_${name})`, `b_${name}: b_${name}` |
| 3 | `statement-compiler/from-import.ts:31,32,34,40,42` | `"${name}"`, error msg, `setVariable("${alias}")` |
| 4 | `statement-compiler/import.ts:16,18` | `frame.set({name:"${target}"})`, `setVariable("${target}")` |
| 5 | `statement-compiler/for.ts:89,115,116,169` | loop var names `"${childValue}"`, `"${keyName}"`, `"${valueName}"`, `"${nameValue}"` |
| 6 | `statement-compiler/scope.ts:16` | `frame.set({name:"${name}"})` |
| 7 | `statement-compiler/compile-capture.ts:13` | `frame.set({name:"${varName}"})` |
| 8 | `statement-compiler/match.ts:38` | `frame.set({name:"${name}"})` |
| 9 | `statement-compiler/compile-output.ts:25` | `varName:"${name}"` |
| 10 | `expression-compiler/container.ts:45` | `contextOrFrameLookup(context,frame,"${name}")` |
| 11 (MEDIUM variant) | `statement-compiler/component.ts:61` + `render.ts:18` | slot names into generated identifiers `__fallback_${slot.name}` / `__slot_${slot.name}` |

**Constraint discovered during analysis:** `b_${name}` identifiers are coupled to `extractBlocks` (`shared/compiled-template.ts:30-38`) which recovers block names via `key.slice(2)`. So block names must round-trip through `b_`-prefixed JS identifiers — the fix is a single `assertSafeIdentifier` gate at the compiler boundary + `JSON.stringify` for all string-position interpolations, not escaping the identifier positions.

---

## MEDIUM (14)

### Dead code / unused exports (§9)
1. **`runtime/context.ts:250`** — `isContext` exported but **zero call sites** repo-wide (not re-exported from package index).
2. **`filters/factory/creators.ts:26-32`** — `createGlobal` exported but **zero call sites** repo-wide.

### Unsafe casts (§6)
3. **`runtime/filter-runtime.ts:39,47,54`** — three `as TypeError` casts on unvalidated caught/Result errors. A filter can throw anything; the `Result<unknown, TypeError>` error channel lies about the runtime shape.
4. **`error-renderer/format/to-text.ts:47,73,99`** — `input.error` (typed `unknown` from public `toText(error: unknown)`) cast to `ErrorLike`/`{severity}`/`Error` without runtime narrowing.
5. **`error-renderer/format/presentation/error/error-parts.ts:11-16`** — `unknown` error cast to structural shape without validation.
6. **`error-renderer/format/presentation/error/sections.ts:72`** — casts `normalizeRenderContext()` output (typed `unknown`) to `Record<...>` then calls `keys()`/`values()`.
7. **`error-formatter/create-log/create-log-error.ts:157-158`** — `extra.sourceContent as string` / `extra?.sourceStartLine as number` after truthiness-only guards (should use `readString`/`readNumber`).
8. **`validators/security/scrubber.ts:23`** — `return visitAndScrub(context, seen) as T` — generic cast where the function rebuilds objects via `Object.fromEntries` (returned shape may differ from `T`).

### Layering (§3)
9. **`runtime/suppress-value.ts:4`** — deep self-import via the package's own published subpath (`@nunjucks/runtime/escaping`) instead of relative `./escaping/index.ts`.
10. **`compiler/statement-compiler/root.ts:8`** — self-package import (`from '@nunjucks/compiler'`) for `BLOCK_META_KEY` instead of `@nunjucks/shared`.
11. **`compiler/expression-compiler/inline.ts:6`** — lateral dependency: `expression-compiler` → `statement-compiler/pattern.ts` (`compileDestructuring`). Not circular, but `compileDestructuring` is a pattern utility misplaced in `statement-compiler/`.
12. **`parser/expression-parser/assignment.ts:48,50`** — `(node as {children: readonly Node[]}).children` casts bypass the `Node` union; tightening `isArray`/`isDict` guard return types (`nodes/types/guards.ts`) to narrow to `ChildrenNode` would eliminate these casts.

### Miscellaneous
13. **`error-renderer/format/to-html-builder.ts:51`** — `_severity` destructured-but-unused (dead param in `buildErrorHeader`).
14. **`lib/path-security.ts:1`** — imports `node:path` (node built-in) in a package documented as a pure, domain-agnostic, no-I/O lib (couples foundational lib to Node runtime).

---

## LOW (~65) — selected notable items

**§9 Dead surface (error-renderer):** `to-html-types.ts:46-47` (`jsCaller`, `jsCallerErrorLine` never read); `to-html-builder.ts:99` (`FullErrorBodyInput.displayPath` never destructured); `to-html-assembly.ts:23` (`ErrorSectionsInput.environment` unreachable from public API).

**§6 Redundant/loose casts (mostly safe-in-practice):** `error-renderer/format/ansi/context-helpers.ts:17,31`; `safe-context.ts:51`; `error-formatter/create-log/create-log-helpers.ts:65`; `create-log.ts:98`; `create-log-error.ts:187`; `parser/test-helpers.ts:4,6` (`unknown → TokenStream`/`ParserContext` test scaffolding); `compiler/test-helpers.ts:3`. Plus ~15 `as TemplateError`/`as ExecuteConfig`/`as Record<...>` casts across `core/render/*` (all guarded or documented with WHY comments, zero `any`).

**§5 Function design:** `runtime/lookups.ts:1` `contextOrFrameLookup(context, frame, name)` — 3 positional params for a non-contract helper; `core/render/render-pipeline.ts:100,105,128-134` — 3-4 param signatures, all interface-constrained to `Env` contract (acceptable); `compiler/statement-compiler/extension.ts:104` — `compileCallExtension(compiler, input, useAsync=false)` boolean flag outside options.

**§3 Style:** `lexer/constants.ts:2` deep subpath import `@nunjucks/lib/is-digit` vs barrel elsewhere; `nodes/factory/index.ts:1-2` duplicate imports from same module.

**§4 Loops:** All reviewed — every `for`/`while` is in a documented exemption tier (parser state-machine `parse-root.ts:132`; async stream polling `render-stream-adapters.ts:14,48`, `render-stream.ts:93`; stream drain `pipe-stream.ts:141`). `loaders/base.ts:28` + `file-system.ts:178` `forEach` are shell-side listener/cleanup dispatch. **Zero non-exempt loops.**

**§10 Samples (all deliberate & documented):** `errors.ts` injects `process`/`globalThis`/`eval`/`setTimeout` + fake secrets (`password:'secret123'`) into render contexts to *demonstrate* the sandbox blocking them — each paired with the security config that neutralizes it and a WHY comment. No real vulnerabilities.

**§8 Naming:** `error-renderer/to-html-assembly.test.ts:5` helper named `createMockError` but is a pure fake (no mock framework used anywhere — good practice, misleading name).

---

## Fix Plan (when ready)

### Priority 1 — HIGH (11) — Compiler §10 defense-in-depth
Single systemic fix in `@nunjucks/compiler`:
1. Add one `assertSafeIdentifier(name)` gate in `codegen.ts` (rejects non-identifier names with a clear compile error — fails closed).
2. Convert every `"${name}"` string-position interpolation to `${JSON.stringify(name)}` across the 10 affected files.
3. Keep `b_${name}` identifier positions consistent (block names must round-trip through `extractBlocks` `key.slice(2)` contract).

**Blast radius:** ~10 files, all within `@nunjucks/compiler`. Existing test suite (real template compilation) will catch any `extractBlocks` contract breakage.

### Priority 2 — MEDIUM (14) — isolated, low-risk
- **Dead-code deletions:** `isContext` (`runtime/context.ts:250`), `createGlobal` (`filters/factory/creators.ts:26-32`).
- **Unsafe-cast hardening:** `filter-runtime.ts` `as TypeError` (widen Result error channel), `scrubber.ts` `as T`, `to-text.ts:47,73,99` (add type guards), `error-parts.ts`, `sections.ts:72`, `create-log-error.ts:157-158`.
- **Self-import cleanup:** `suppress-value.ts:4` → relative, `root.ts:8` → `@nunjucks/shared`.
- **Lateral dep:** relocate `compileDestructuring` out of `statement-compiler/`.
- **Guard types:** tighten `isArray`/`isDict` in `nodes/types/guards.ts` to eliminate `assignment.ts` casts.
- **Dead param:** remove `_severity` from `to-html-builder.ts`.
- **node:path in lib:** assess whether to relocate `path-security.ts` or document the node-coupling.

### Priority 3 — selective LOW wins
- Remove dead error-renderer interface fields (`jsCaller`, `jsCallerErrorLine`, `displayPath`, `environment`).
- Rename `createMockError` → `createFakeError`.
- Merge duplicate imports, normalize barrel usage.

### Verification after each priority tier
```
bun run typecheck   # tsc --noEmit
bun run lint        # biome lint packages samples
bun test            # 2676 tests must remain green
```

---

## FIX STATUS (applied 2026-08-13)

All fixes applied with intention and taste. **Final state: typecheck clean, lint clean (609 files), 2676 tests pass / 0 fail.** 34 source files touched (+386/-285 lines).

### Tier 1 — HIGH (11/11) FIXED ✅
Added `assertSafeIdentifier` helper to `codegen.ts` + `INVALID_IDENTIFIER` error-catalog entry. Applied to all 11 compiler §10 sites:
- `block.ts`, `root.ts`, `from-import.ts`, `import.ts`, `for.ts`, `scope.ts`, `compile-capture.ts`, `match.ts`, `compile-output.ts`, `container.ts`, `component.ts`/`render.ts` (slot names).
- All `"${name}"` string positions → `${JSON.stringify(name)}`; all `b_${name}` identifier positions gated by `assertSafeIdentifier`. The `extractBlocks` `b_`-prefix contract preserved (verified by test suite).
- Updated `from-import.test.ts` expectations to match the new safe output format.

### Tier 2 — MEDIUM (12/14) FIXED ✅ (2 documented)
- **Dead code removed:** `isContext` (runtime/context.ts), `createGlobal` (filters/factory/creators.ts + re-export).
- **Unsafe casts hardened:** `filter-runtime.ts` (`as TypeError` ×3 → widened Result to `unknown`), `scrubber.ts` (`as T` documented with WHY invariant), `to-text.ts` (added `isErrorRecord` guard, eliminated 3 casts), `error-parts.ts` (added `readErrorPartFields` narrowing), `sections.ts` (added `isSerializableRecord` guard), `create-log-error.ts` (`as string`/`as number` → `typeof` guards).
- **Self-imports fixed:** `suppress-value.ts` (`@nunjucks/runtime/escaping` → `./escaping/index.ts`), `root.ts` (`@nunjucks/compiler` → `@nunjucks/shared`).
- **Guard types tightened:** `isArray`/`isDict` in `nodes/types/guards.ts` now narrow to `ChildrenNode` → eliminated `(node as {children}).children` casts in `assignment.ts` + `comparison.ts` (`'children' in sig` → `isChildrenNode(sig)`).
- **Dead params/surface removed:** `_severity` from `to-html-builder.ts` `ErrorHeaderInput`, `displayPath` from `FullErrorBodyInput` + `ErrorBodyContentInput`.
- **`node:path` in lib:** documented as pure string-manipulation (no I/O) with WHY comment — not a §2 violation.
- **Deferred:** `compileDestructuring` lateral dep — intra-package, not circular, documented (moving it is high-friction/low-value).

### Tier 3 — selective LOW (4) FIXED ✅
- Renamed `createMockError` → `createFakeError` (it's a pure fake, not a mock).
- Merged duplicate imports in `nodes/factory/index.ts`.
- Normalized `lexer/constants.ts` deep subpath (`@nunjucks/lib/is-digit` → `@nunjucks/lib` barrel — `isDigit` IS exported from barrel).

### Findings NOT fixed (intentional)
- ~60 LOW §6 casts across `core/render/*` (`as TemplateError`/`as ExecuteConfig`/`as Record<...>`) — all guarded or documented with WHY comments, zero `any`. Hardening each would add noise without meaningful safety gain.
- §5 function-design LOWs (3-4 param interface-constrained signatures in `Env` contract) — acceptable per ruleset exemptions.
- `jsCaller`/`jsCallerErrorLine` audit flag — false positive (verified they're wired through `metadata.ts` → `sections.ts` JS-trace rendering).

---

## ROUND 2 AUDIT (independent re-scan, 2026-08-13)

Re-scanned all 16 packages + samples against §1–§12 with independent greps for: `any`, `as unknown as`, `for`/`while`/`forEach`, `console.*`, hardcoded secrets, numeric-suffix names, pseudo-private `_var`, `throw`, mocks, sequential `await`, dependency direction (lib↔shared↔packages), dead exports, `biome-ignore`/`@ts-ignore`, TODO/FIXME, boolean flags, parameter counts.

**Result: baseline still CLEAN (typecheck ✅, lint ✅ 609 files, 2676 tests ✅).** All Round-1 HIGH/MEDIUM fixes verified present in source. 2 remaining actionable violations found and fixed:

### Round-2 Fixes

| # | Rule | Violation | Fix |
|---|---|---|---|
| 1 | §3 Strict Acyclic Dependencies + §9 Aggressive Cleanup | `@nunjucks/log` declared as a workspace + root dependency but **has no source directory, zero importers repo-wide**. Orphan/dead dependency entry. | Removed `packages/@nunjucks/log` from `workspaces[]` and `"@nunjucks/log": "workspace:*"` from root `dependencies` in `package.json`. |
| 2 | §5 Configuration Objects ("if any parameter is a boolean flag, you MUST bundle into an options object") | `extension.ts:104` `compileCallExtension(compiler, input, useAsync = false)` — boolean flag as 3rd positional param. | Removed the boolean flag. `compileCallExtension` is now sync-only (2 params); `compileCallExtensionAsync` owns its own emit-sequence (hardcoded `emitAsync = true`) instead of delegating via the flag. No public-API breakage — dispatch table (`node-dispatch.ts:162-163`) calls each by type, tests call sync variant with 2 args. |

**Verification after Round 2:** typecheck clean, lint clean (609 files), 2676 tests pass / 0 fail.

---

## ROUND 3 AUDIT (independent re-scan, 2026-08-16)

5 parallel audit agents re-scanned all 16 packages + samples against §1–§11 (Phase I architecture, Phase II type-safety/threat, Phase II loops/pipelines/async/errors, Phase III testing/naming/lifecycle, samples OWASP). Baseline before fixes: typecheck ✅, lint ✅ (617 files), 2723 tests ✅ — no pre-existing errors; all findings were rule-compliance gaps.

### Round-3 Fixes

| # | Rule | Severity | Violation | Fix |
|---|---|---|---|---|
| 1 | §10 Injection immunity | MEDIUM | `component.ts` — component arg names emitted as raw JS identifiers `l_${value}` without `assertSafeIdentifier` (the only remaining compiler codegen gap; slot.ts already gated). | Added the gate in `extractComponentArgs` mirroring `slot.ts`; locked with a regression test (`component.test.ts` rejects `a";evil()` with `INVALID_IDENTIFIER`). |
| 2 | §5 Unsafe casts | MEDIUM | `pipe-stream.ts:97,256` — caught-`unknown` mid-stream errors cast to `TemplateError`/`Error` without narrowing. | Added `toErrorLike` normalizer (`err instanceof Error ? err : new Error(String(err))`) at both sites. |
| 3 | §8 Shadowing enforcement | MEDIUM | biome `noShadow` absent from config while CLAUDE.md prohibits shadowing. | Enabled `noShadow: "error"` in `biome/linter.json`; fixed all 21 surfaced violations: lexer `comment.ts`/`template-text.ts` scan-callback shadowed destructured results, `lib/collect-stream.ts` `acc`, and `loc` callback params shadowing the imported `loc` factory in nodes factory tests (renamed to role-descriptive `position`/`endState`/`dataText`/`commentValue`/`chunks`). |
| 4 | §9 Dead exports | MEDIUM | 7 fully-dead types: `AccessResult`, `IoErrorName`, `SandboxErrorName`, `FilterErrorName`, `ParserErrorName`, `TemplateErrorName`, `RuntimeErrorName`. | Deleted (same `*ErrorName` straggler family as Round-1's `LoaderSource` removals). |
| 5 | §9 Mock vocabulary | MEDIUM | 25 compiler test files named pure fakes with banned `mock` vocabulary (`MockNode`, `{ mock: 'X' }`, `leftMock`). | Mechanical rename to `FakeNode`/`marker`/`leftMarker` (~110 occurrences); zero behavior change, compiler suite identical (204/204). |
| 6 | §1 YAGNI | LOW | `runtime/hooks.ts` — 6 of 9 `HOOK_EVENTS` never emitted anywhere. | Deleted the 6 speculative events; WHY comment now states events are added together with their emitting call site. New drift-guard test asserts the constant map matches the emitted set. |
| 7 | §1 Rule of Three | LOW | `lib/gensym.ts` — two-layer id-generator abstraction with a single leaf caller. | Inlined into `createGensym`. |
| 8 | §5 Parameter limits | LOW | `diagnostics.ts` `wrapWithLog(err, config, {…})` — 3 inputs, only third bundled. | Refactored to single `WrapWithLogInput` options object; 14 call sites updated. |
| 9 | §11 Dead surface | LOW | 27 module-internal-only exports carrying `export`; `ContextMetadata` + `SecurityError` barrel re-exports with zero consumers; test-only exports `isFor`, `isLoader`, `isValidUndefinedMode`. | Unexported the 27; removed both barrel lines; deleted the 3 dead guards + their sole-coverage tests (11 tests). ~15 audit candidates verified kept-alive (real usage found — false positives). |
| 10 | §8 Numeric suffixes | LOW | `result1/2/3` (filters tests), `global1: 'value1'` (render-pipeline.test.ts), `p1`/`p2` (samples `errors/index.njk` DOM code). | Role-descriptive renames (`nullInputResult`, `globalGreeting`, `noResultsMessage`/`noResultsHint`). |
| 11 | OWASP A05 | LOW | `samples/express/main.ts` `app.listen(PORT)` bound all interfaces while serving rich dev error pages. | Bound `127.0.0.1` with a WHY comment (mirrors the test server). |
| 12 | §6 Style / §3 type safety | LOW | Duplicate `@nunjucks/lib` imports (samples `errors.ts`, `sandbox-demo.ts`); unnarrowed `as AddressInfo` (samples `app.test.ts`); misleading `raw:` labels in `security-features.njk` (output is autoescaped). | Merged imports; replaced cast with `null`/`string` narrowing that fails loudly; labels now `direct:`. |
| 13 | §2 Boundary documentation | LOW | `core/src/diagnostics/**` fs reads and `runtime/src/shell/**` console pocket were real but undocumented exemptions. | Sanctioned both pockets explicitly in ARCHITECTURE.md §2 (complete list of non-loader I/O sites). |

### Round-3 Findings NOT fixed (intentional, with taste)

- **F7 clock injection** (`executor.ts` `Date.now`): the deadline mechanism is inherently wall-clock; bun's `setSystemTime` covers test determinism — injecting a clock adds API surface for no real purity gain (KISS).
- **SSOT enriched-error trio** (`ErrorLike`/`TemplateError`/`ErrorWithLineInfo`): making `TemplateError` extend `ErrorLike` would still require redeclaring every field (optional→required narrowing), so the refactor consolidates nothing (Rule of Three/YAGNI). Load-bearing invariants (`TEMPLATE_ERROR`, `LineBase`, `Phase`) already single-sourced.
- **lexer → error-formatter edge** (vs leaner error-catalog): not a cycle, not prohibited; extraction is high-friction/low-value.
- **`create-log.ts:98` / `create-log-helpers.ts:65` casts**: `RawLogData.info` is an internally-constructed typed union, not untrusted I/O; all reads nullish-guarded — §5 boundary sanitization doesn't apply.
- **Plugin fold single-consumer** (`foldPlugins`): documented public `plugins` config surface (ARCHITECTURE §9), tested — YAGNI-watch only.
- **ANSI/text `full` verbosity default**: server-log sinks only (HTTP paths are dev-gated + JSON payload is stack-free) — documented design.
- **Audit artifacts at repo root** (`AUDIT-REPORT.md`, `SOURCE-TRACE-FIX-AUDIT.md`): tracked intentionally; relocation is cosmetic churn.

### Verification after Round 3

`bun run typecheck` → 0 errors · `bun run lint` → 617 files, 0 issues (now with `noShadow: error` enforced) · `bun test` → **2714 pass / 0 fail** (2723 − 11 deleted dead-guard tests + 2 new: hooks drift-guard + component §10 regression).


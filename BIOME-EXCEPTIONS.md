# Biome rule exceptions

Every rule group in `biome.json` is set to `error`. The `overrides` section
turns off exactly four rules. Each one is listed here with the reason it
cannot be satisfied by correct code in this repository.

Anything that *can* be fixed stays on. Local, one-off exceptions use a
`biome-ignore` comment with the reason on the line itself, not a config entry.

## Repository-wide

| Rule | Why it is off |
|---|---|
| `correctness/noUndeclaredDependencies` | Biome resolves dependencies from each package's own `package.json`. It does not follow `workspace:*` links, and it does not see devDependencies hoisted to the workspace root. As a result it reports `remeda` and every `@nunjucks/*` import as undeclared. They are declared. |
| `correctness/noNodejsModules` | This is a Node.js templating library: it reads templates from disk, resolves paths, and watches files. The rule exists to keep Node builtins out of browser bundles, which is not a constraint here. |
| `security/noSecrets` | The findings are inline SVG icon markup (`log/src/render/internal/ide-links.ts`) and example snippets inside error-message definitions. There are no credentials in this repository. |
| `performance/noBarrelFile` and `performance/noReExportAll` | These contradict `style/noExportedImports`, which is on. `noExportedImports` requires `export { x } from './y.ts'` instead of importing and re-listing; `noBarrelFile` then flags that same statement — including in modules like `filters/src/filters/array.ts` that hold real implementations and only re-export one helper. Both cannot hold at once. The barrel rules also target app-bundle tree-shaking, which does not apply to a library whose `package.json` `exports` map deliberately points at per-package index files. |
| `performance/noNamespaceImport` | Every finding is the aggregate pattern the syntax exists for: `import * as stringFilters from '@nunjucks/filters/string'` in the global config, and `import * as guards` / `import * as traverse` behind the node extension API. Listing each filter and guard by name instead would have to be updated by hand every time one is added, and silently go stale when it is not. |
| `correctness/useQwikValidLexicalScope` | A Qwik framework rule that enforces Qwik's `$`-boundary serialization constraints. This repository is a templating engine and does not use Qwik. |

| `correctness/noUnresolvedImports` | Two unrelated causes, both outside our control. In tests, every finding is `import { ... } from 'bun:test'`, a module namespace Biome does not know. In production source, the findings are `escapeHtml`, which reaches its importers through a two-hop re-export (`shared/index.ts` → `escape-context.ts` → `escape.ts`) that Biome's resolver does not follow. TypeScript resolves all of them, and the build and tests pass. Note the second cause is a direct consequence of `noExportedImports`, which is on and requires exactly that re-export form. |

## Size and complexity thresholds

These are raised from Biome's defaults rather than disabled. The defaults
(50 lines per function, complexity 15) flagged 130 findings with a median
function length of 89 lines, so they were not identifying outliers — they were
describing the codebase.

The numbers below were chosen from what the code looks like *after* the
functions that genuinely needed splitting were split:

| Rule | Default | Here | Why |
|---|---|---|---|
| `noExcessiveCognitiveComplexity` | 15 | 35 | The six functions worth splitting all measured 47 or above (compileDestructuring 82, toHtml 68, the expression validator 55, findFirst 49, normalizeValue 47, createLog 38). After splitting they sit between 17 and 31. 35 is above the settled band and below the "this needs work" band. |
| `noExcessiveLinesPerFunction` | 50 | 100 | Same reasoning. Well-structured functions here land at 50–90 lines; the ones that needed splitting were 210 and up. |

A caveat worth stating: splitting a function creates new function boundaries,
and each new boundary is measured independently. Six substantial refactors
reduced the total finding count by four, because the extracted functions
picked up findings of their own. Chasing zero on these rules does not converge.

## Test files only, for the size rules

`noExcessiveLinesPerFunction` and `noExcessiveLinesPerFile` are off for
`*.test.ts`. 27 of the 55 function-length findings were `describe()`
callbacks — a whole test suite measured as if it were one function. That is a
category error, not a finding. The complexity rule stays on for tests, where it
reported nothing anyway.

## Parser package only (`packages/@nunjucks/parser/src/**`)

| Rule | Why it is off |
|---|---|
| `suspicious/noImportCycles` | The remaining cycles are the grammar's own recursion, and they cannot be removed without violating a rule that is also on. See below. |

This one is worth spelling out, because it was not obvious until measured.

75 findings were reported. 12 of them were real and are fixed: parser modules
were reaching `parseExpression`, `parsePrimary` and friends through
`expression-parser/index.ts` and `node-parsers/index.ts`. A barrel re-exports
everything, so importing one symbol from it creates an edge to every module
behind it, inflating two-node recursions into cycles spanning a dozen files.
Every import now names the module that defines the symbol.

What is left is the grammar:

```
primary -> aggregate -> primary                     // [a, b] contains expressions
arithmetic -> unary -> primary -> ... -> arithmetic // the precedence ladder
top-level -> statement-parser/for -> top-level      // {% for %} contains statements
```

A recursive-descent parser for a language with nested expressions and nested
blocks cannot have an acyclic module graph when it is split one function per
file. ES modules resolve these correctly: every binding involved is called
after module initialisation completes, never during it.

Removing them means merging each recursive group into a single module. Measured:

| Merged group | Lines | `noExcessiveLinesPerFile` limit |
|---|---|---|
| Expression precedence chain | 853 | 300 |
| Statement chain | 1254 | 300 |

So satisfying `noImportCycles` here forces a 2.8x and a 4.2x violation of
`noExcessiveLinesPerFile`, which is also on. The two rules cannot both hold in
this package. The rule stays on everywhere else, and the one genuine cycle
outside the parser -- `log/src/diagnostics.ts` importing from its own package
entry point -- was fixed rather than suppressed.

## Test files only (`**/*.test.ts`)

| Rule | Why it is off |
|---|---|
| `suspicious/noProto` | Every finding is in `sandbox.test.ts`, `sandbox.property.test.ts` or `security.test.ts`, which exist specifically to prove that `__proto__` access is blocked. The tests have to name the thing they are defending against. |
| `suspicious/noEmptyBlockStatements` | Test doubles such as `filters: { 'if': () => {} }`, registered only to assert that a reserved name is rejected. The body is empty because the filter is never meant to run. Both findings in production source were fixed rather than suppressed. |
| `suspicious/noExplicitAny` | Prototype-pollution payloads in the sandbox tests, which are deliberately ill-typed values. Production source is free of `any` and the rule stays on there. |
| `performance/useTopLevelRegex` | A performance rule: it exists so a hot path does not recompile a pattern per call. Test bodies run once, and `expect(x).toMatch(/caller-file\.test\.ts$/)` is clearer inline than as a module-level constant. All 70 findings in production source were hoisted; only the 3 in assertions are exempt. |
| `style/noNonNullAssertion` | The standard test idiom is `expect(x).not.toBeNull()` followed by `expect(x!.y)`, where the preceding assertion is what establishes the invariant. Biome's own suggested fix rewrites `x!` to `x?.`, which turns a test that should fail loudly into one that silently reads `undefined` — strictly worse in a test. All 51 findings in production source were resolved individually; the rule stays on there. |
| `style/noMagicNumbers` | 335 of the 341 findings were in tests. Concrete literal values are the point of a test: `literal(1, 1, 42)` and `expect(x).toBe(3)` say more than named constants would. The 6 findings in production source were fixed with named constants rather than suppressed, and the rule stays on there. |

## Re-checking these

If Biome gains workspace-aware dependency resolution or Bun module
awareness, drop the matching override and re-run `bun run lint`. The
exceptions are narrow on purpose so that this stays cheap to verify.

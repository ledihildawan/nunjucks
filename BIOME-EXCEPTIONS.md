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
| `correctness/useQwikValidLexicalScope` | A Qwik framework rule that enforces Qwik's `$`-boundary serialization constraints. This repository is a templating engine and does not use Qwik. |

## Test files only (`**/*.test.ts`)

| Rule | Why it is off |
|---|---|
| `correctness/noUnresolvedImports` | Every finding is `import { ... } from 'bun:test'`. Biome does not know Bun's built-in module namespace. Production sources are still checked by this rule. |
| `performance/useTopLevelRegex` | A performance rule: it exists so a hot path does not recompile a pattern per call. Test bodies run once, and `expect(x).toMatch(/caller-file\.test\.ts$/)` is clearer inline than as a module-level constant. All 70 findings in production source were hoisted; only the 3 in assertions are exempt. |
| `style/noNonNullAssertion` | The standard test idiom is `expect(x).not.toBeNull()` followed by `expect(x!.y)`, where the preceding assertion is what establishes the invariant. Biome's own suggested fix rewrites `x!` to `x?.`, which turns a test that should fail loudly into one that silently reads `undefined` — strictly worse in a test. All 51 findings in production source were resolved individually; the rule stays on there. |
| `style/noMagicNumbers` | 335 of the 341 findings were in tests. Concrete literal values are the point of a test: `literal(1, 1, 42)` and `expect(x).toBe(3)` say more than named constants would. The 6 findings in production source were fixed with named constants rather than suppressed, and the rule stays on there. |

## Re-checking these

If Biome gains workspace-aware dependency resolution or Bun module
awareness, drop the matching override and re-run `bun run lint`. The
exceptions are narrow on purpose so that this stays cheap to verify.

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
| `correctness/useQwikValidLexicalScope` | A Qwik framework rule that enforces Qwik's `$`-boundary serialization constraints. This repository is a templating engine and does not use Qwik. |

## Test files only (`**/*.test.ts`)

| Rule | Why it is off |
|---|---|
| `correctness/noUnresolvedImports` | Every finding is `import { ... } from 'bun:test'`. Biome does not know Bun's built-in module namespace. Production sources are still checked by this rule. |

## Re-checking these

If Biome gains workspace-aware dependency resolution or Bun module
awareness, drop the matching override and re-run `bun run lint`. The
exceptions are narrow on purpose so that this stays cheap to verify.

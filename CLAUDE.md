# Nunjucks Engineering Guidelines

Monorepo of the nunjucks templating engine, split into focused `@nunjucks/*` workspaces (shared, log, nodes, lexer, parser, transformers, compiler, runtime, filters, loaders, validators, integrations, core). Verified compliant with the principles below on commit `72ead61e` — 465 source files, 0 lint issues, 0 `any` violations, 1796 tests passing.

## 1. Core Architectural Principles

- **Clean Code, SOLID, YAGNI, KISS** — apply always; reject abstraction that isn't needed now.
- **Functional Programming** — prefer pure functions, composition (`pipe`, `flatMap`, `reduce` from `remeda`), immutability. No classes for domain logic.
- **No overengineering, no premature optimization.**

## 2. Project Structure & Co-location

- **Contextual routing** — directory placement reflects domain context (`errors/`, `security/`, `escaping/`, `expression-parser/`, `statement-compiler/`). Rename directories when their scope shifts.
- **Strict naming conformity** — file/dir names must precisely match what the code does.
- **Test co-location** — `foo.ts` ships with `foo.test.ts` adjacent. Migrate tests whenever restructuring.

## 3. TypeScript Type Safety

- **`any`** — temporary escape hatch only, for highly dynamic ops. Never as a default.
- **`unknown`** — default for external data or uncertain shapes; narrow before use.
- **Generics** — all helper/utility functions use `<T>` (and additional type params as needed) for reusability and type safety.

## 4. Naming & Readability

- **Self-documenting names** — code explains itself; minimize inline comments.
- **No variable shadowing** — strictly prohibited.
- **Aliases** — avoid module/type/variable aliases unless resolving collisions.
- **Flow clarity** — decompose complex logic into small, sequenced functions with traceable flow.
- **Clean comments** — strip dead, redundant, or unnecessary comments. Keep only WHY comments (e.g. `biome-ignore` justifications).

## 5. Syntax Modernization

- Use modern ECMAScript/TypeScript features: `replaceAll`, `Object.hasOwn`, `Number.isInteger`, optional chaining, nullish coalescing, `as const`, `matchAll`, iterator helpers.
- Deprecate legacy patterns (e.g. `String.prototype.replace` with global regex when `replaceAll` fits, manual `hasOwnProperty` calls, etc.).

## Verification Before Commit

```
bun run typecheck   # tsc --noEmit
bun run lint        # biome lint packages samples
bun test            # bun test
```

All three must pass clean.
# Nunjucks Engineering Guidelines

> **Authoritative standard:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) is the full, detailed Project Architecture & Coding Standards (layering taxonomy, advanced primitives, boundary validation, function design, naming). This file is the condensed cheat-sheet — when in doubt, defer to `ARCHITECTURE.md`.

Monorepo of the nunjucks templating engine, split into focused `@nunjucks/*` workspaces (lib, shared, error-catalog, error-renderer, error-formatter, nodes, lexer, parser, transformers, compiler, runtime, filters, loaders, validators, integrations, core). Verified compliant — 0 lint issues, 0 `any` violations; run `bun test` for the current suite size (counts drift with every change, so they are not pinned here).

> **Public API:** the single entry point is `import { nunjucks } from '@nunjucks/core'`. `nunjucks(config)` returns an engine (`render` / `renderToStream` / `pipeRenderStream`); it is a thin wrapper over the base `createNunjucks` in `core/src/factory.ts`. The flat `render(template, options)` exports are engine-internal (used by the factory + core tests via relative imports) and NOT re-exported from the public index. See `ARCHITECTURE.md` §9 for the factory, config nesting, plugin layering, and the two-pass render pipeline.

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

- **Strict Semantic Naming** — variable, function, and parameter names must express domain intent clearly. Generic numeric suffixes (e.g. `node1`, `node2`, `data1`, `item2`) are strictly prohibited. Use role-descriptive names (e.g. `leftNode`, `rightNode`, `sourceData`, `targetData`).
- **Self-documenting names** — code explains itself; minimize inline comments.
- **No variable shadowing** — strictly prohibited.
- **Aliases** — avoid module/type/variable aliases unless resolving collisions.
- **Flow clarity** — decompose complex logic into small, sequenced functions with traceable flow.
- **Clean comments** — strip dead, redundant, or unnecessary comments. Keep only WHY comments (e.g. `biome-ignore` justifications).

## 5. Syntax Modernization & Loop Policy

- Use modern ECMAScript/TypeScript features: `replaceAll`, `Object.hasOwn`, `Number.isInteger`, optional chaining, nullish coalescing, `as const`, `matchAll`, iterator helpers.
- Deprecate legacy patterns (e.g. `String.prototype.replace` with global regex when `replaceAll` fits, manual `hasOwnProperty` calls, etc.).
- **Map/Filter/Reduce for collection transformations** — traditional for/while loops are strictly prohibited in Core/Domain layer code.
- **Loop exemption (Optimization & Performance)** — for/while loops ARE permitted in isolated pure abstractions under three scenarios: (1) AST Parsers / Compilers / High-Throughput Engines (memory/GC overhead), (2) Recursion Safety / Trampolining (stack overflow prevention), (3) Async Time-based Control Flows (polling, retry, stream processing).

## Verification Before Commit

```
bun run typecheck   # tsc --noEmit
bun run lint        # biome lint packages samples
bun test            # bun test
```

All three must pass clean.
# Nunjucks

A powerful templating engine with inheritance, asynchronous control, streaming, and a factory-based config API (jinja2-inspired).

This is a TypeScript monorepo of focused `@nunjucks/*` workspaces. The public entry point is the `nunjucks(config)` factory. Version 4.0.0 marks the clean break from the upstream 3.x JS API (`Environment`, `addFilter`, callbacks) — config is declarative and baked into the engine at factory time.

## Install

```
bun add @nunjucks/core
```

## Quickstart

```ts
import { nunjucks } from '@nunjucks/core';

// Configure once — filters, globals, security, limits, etc. are baked into the engine.
const njk = nunjucks({
  views: '/templates',
  undefined: 'strict',
  filters: { shout: (v: string) => v.toUpperCase() },
  globals: { appName: 'Demo' },
});

// Per-call: just the template + context (+ optional per-render overrides).
const result = await njk.render('Hello {{ name }}!', { name: 'World' });
if (result.ok) {
  console.log(result.value); // "Hello World!"
}
```

## Streaming

```ts
const njk = nunjucks({
  views: '/templates',
  streaming: { errorRecovery: true, contentType: 'html', idleTimeout: 10_000 },
  limits: { executionTimeout: 30_000, maxOutputSize: 2 * 1024 * 1024 },
});

const stream = await njk.renderToStream('dashboard.njk', { user });
// Pipe to an Express/Bun/Deno response sink:
await njk.pipeRenderStream(stream, res, { signal: abortController.signal });
```

## Config overview

`nunjucks(config)` takes a nested `NunjucksConfig`:

| Group | Fields | Purpose |
|-------|--------|---------|
| (top-level) | `dev`, `views`, `autoescape`, `undefined`, `trimBlocks`, `lstripBlocks`, `ide` | Core rendering options |
| `security` | `sandbox`, `sandboxMode`, `sandboxAllowlist`, `blockedContextKeys`, `contextStrict`, `scanContextValues`, `strictMode`, `allowedGlobals` | Sandbox + context safety |
| `limits` | `executionTimeout`, `maxTemplateSize`, `maxOutputSize` | Time/size bounds |
| `streaming` | `errorRecovery`, `contentType`, `idleTimeout`, `coalesceBytes` | Streaming render behavior |
| (extensions) | `filters`, `globals`, `tests`, `extensions`, `dompurify` | Template extensions |
| `loaders` | `TemplateLoader[]` | Custom template sources (see below) |
| `plugins` | `NunjucksPlugin[]` | Composable bundles of the above |

### Custom loaders

Supply `loaders` to take full control of template resolution (first-match-wins chain). A loader is any object with `getSource(name)` returning the source, `null` (not found — next loader tries), or a hard error. A non-empty chain **replaces** filesystem resolution entirely — `views` is ignored; include `createFileSystemLoader(paths)` in the array to keep filesystem lookup:

```ts
import { createFileSystemLoader } from '@nunjucks/loaders';
import { nunjucks } from '@nunjucks/core';

const memoryLoader = {
  getSource: async (name: string) =>
    name === 'hello.njk' ? { ok: true, value: { src: 'Hello {{ name }}', path: name } } : null,
};

const njk = nunjucks({
  loaders: [memoryLoader, createFileSystemLoader('/templates')],
});
```

`TemplateLoader` / `TemplateLoaderSource` / `createLoaderChain` / `createFileSystemLoader` are public contract from `@nunjucks/loaders`.

### Plugins

```ts
const datePlugin = {
  name: 'dates',
  filters: { dateFmt: (iso: string) => new Date(iso).toLocaleDateString() },
  globals: { now: () => new Date().toISOString() },
};

const njk = nunjucks({ plugins: [datePlugin] });
```

Plugins fold left-to-right; the user's direct `filters`/`globals` override plugin contributions, which override built-in defaults.

## Public API surface

Everything the engine needs ships from the core barrel:

| Export | Kind | Purpose |
|--------|------|---------|
| `nunjucks` | factory | The single entry point |
| `PACKAGE_VERSION` | value | Engine version surfaced to templates as `{{ version }}` |
| `formatError` | function | Render a `TemplateError` as text/ANSI/HTML for error pages |
| `NunjucksConfig`, `NunjucksEngine`, `PerRenderOverrides`, `SecurityConfig`, `LimitsConfig`, `StreamingConfig`, `NunjucksPlugin` | types | Config authoring + engine signatures |
| `RenderStreamResult`, `PipeSink`, `PipeRenderStreamOptions` | types | Annotate `renderToStream` / `pipeRenderStream` calls |
| `TemplateError`, `SourceFileReader`, `Result` | types | Error/context types used across the API |

Two subpath entries are public contract: `@nunjucks/core/diagnostics` (`readProjectSource` — map caller source files for error pages) and `@nunjucks/integrations/express` (`createEngine` for Express 5). Utilities like the `Result` helpers (`isOk`, `isErr`, `getOrElse`) live in `@nunjucks/lib`.

Everything else (`createNunjucks`, plugin folding internals, streaming adapters, sandbox primitives) is engine-internal and reachable only within the repo.

## Express integration

```ts
import { createEngine } from '@nunjucks/integrations/express';
app.engine('njk', createEngine({ dev: true, views: '/templates' }));
app.set('view engine', 'njk');
```

`createEngine` builds one `nunjucks()` engine at registration and delegates each request.

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — full Project Architecture & Coding Standards (§9 covers the entry point, render pipeline, plugin layering).
- [`CLAUDE.md`](./CLAUDE.md) — condensed contributor cheat-sheet.
- [`samples/`](./samples) — runnable demos (`samples/express`, `samples/vanilla-ts`).

## Development

```
bun run typecheck   # tsc --noEmit (includes samples)
bun run lint        # biome lint packages samples
bun test            # bun test
```

## License

BSD-2-Clause.

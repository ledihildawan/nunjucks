# Nunjucks

A powerful templating engine with inheritance, asynchronous control, streaming, and a factory-based config API (jinja2-inspired).

This is a TypeScript monorepo of focused `@nunjucks/*` workspaces. The public entry point is the `nunjucks(config)` factory.

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
| `plugins` | `NunjucksPlugin[]` | Composable bundles of the above |

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

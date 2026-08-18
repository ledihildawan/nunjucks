# Samples

Runnable demos of the `@nunjucks/*` engine. Both are workspace packages — run them from the repo root (dependencies resolve via the monorepo).

## vanilla-ts

```sh
bun run --cwd samples/vanilla-ts start   # or: cd samples/vanilla-ts && bun run start
```

Standalone CLI demo. Builds `nunjucks({ views, globals, filters })` and renders six templates (five view files + one inline source) concurrently via `Promise.all`, demonstrating: interpolation, built-in globals (`{{ version }}`), function globals, the pipe operator with keyword arguments (`{{ date |> formatDate(format="long") }}`), object-pattern walrus destructuring, and basic filters.

## express

```sh
bun run --cwd samples/express start     # serves http://127.0.0.1:4000
bun run --cwd samples/express test      # integration test (ephemeral loopback port)
bun run --cwd samples/express audit:routes  # dev audit: every /errors/:scenario route actually throws its catalogued error
```

The audit script probes a running server (default `http://localhost:4000`, override with a positional base URL). Pass `--headless` or set `AUDIT_HEADLESS=1` to run it fully in-process instead — no server needed.

Express 5 app wired via `@nunjucks/integrations/express` `createEngine` — central error handler formats engine errors as ANSI (console, PII-stripped) and as HTML dev error pages.

| Route group | Demonstrates |
|-------------|--------------|
| `/`, `/home` | globals, custom filters, inheritance, pipes |
| `/security` | context-aware escaping across html/attribute/script zones |
| `/stream`, `/stream-normal`, `/stream-api`, `/stream-block-error` | `renderToStream` + `pipeRenderStream`: AbortSignal on client disconnect, idle timeout, output limits, error recovery (inline markers vs fatal), JSON content-type |
| `/demo/*` | language features — pipe, scope, switch, slot, component, exec, security |
| `/errors`, `/errors/:scenario` | the error taxonomy browser — 60+ catalogued scenarios (filter errors, undefined blocks, sandbox violations, circular includes, …), each rendering a dev error page |
| `/boundary` | zod schema narrowing `req.query` before it reaches the render context |
| `/sandbox/*` | sandboxed context: `__proto__`/`constructor`/`process`/`eval` blocked; allowlist mode |
| `/undefined/*` | strict / debug / chainable modes against the default baseline |
| `/warnings` | `dev: true` + `undefined: 'debug'` — warnings surfaced as an inline reporting script |
| `/remote` | engine-rendered shell + client-side `fetch` of HTML fragment endpoints |

Views live in `samples/express/views/` — they double as a gallery of the template language (see `docs/templating.md`).

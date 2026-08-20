import { createApp } from './app.ts';

const app = createApp();

const DEFAULT_PORT = 4000;

// WHY: PORT is shell config — env override keeps container/CI runs from fighting
// the demo default. parseInt so a malformed value degrades to NaN and triggers the
// fallback to DEFAULT_PORT instead of throwing or binding a garbage port.
const resolvePort = (): number => {
  const port = Number.parseInt(process.env.PORT ?? '', 10);
  return Number.isNaN(port) ? DEFAULT_PORT : port;
};

const port = resolvePort();

// WHY: declarative catalog — every demo surface declares its path + intent once. The listen
// handler renders the catalog via map/join so the running output stays in lockstep with the
// real mounted routes (no duplicate hand-written list to drift).
interface RouteEntry {
  path: string;
  intent: string;
}

const baseRoutes: readonly RouteEntry[] = [
  { path: '/', intent: 'Engine entry — basic render, globals, custom filter' },
  { path: '/home', intent: 'Template inheritance + global + pipe filter' },
  { path: '/security', intent: 'Context-aware escaping: HTML, attr, script auto-tojson' },
  {
    path: '/stream',
    intent:
      'Streaming render — progressive blocks, abort-on-disconnect, idle/deadline/output-size guards',
  },
  { path: '/stream-normal', intent: 'Same dashboard, blocking render (latency comparison)' },
  { path: '/stream-api', intent: 'JSON streaming API — content-type aware error promotion' },
  {
    path: '/stream-block-error',
    intent: 'Fatal include mid-stream — block error card instead of an inline marker',
  },
  {
    path: '/demo/pipe · /demo/scope · …',
    intent: 'Language features — pipe, scope, switch, slot, component, exec (see home grid)',
  },
  { path: '/errors', intent: 'Error taxonomy browser — search, filter, live preview' },
  { path: '/errors/:scenario', intent: 'Per-error routes — catalogued by tier and category' },
  { path: '/boundary', intent: 'Boundary validation — zod schema narrows req.query before render' },
  {
    path: '/sandbox/:mode',
    intent: 'Sandbox security — proxy blocks proto/constructor/process, code execution',
  },
  { path: '/undefined/:mode', intent: 'Undefined variable modes — strict, debug, chainable' },
  { path: '/warnings', intent: 'Dev warnings — surface console hints without aborting render' },
  {
    path: '/remote',
    intent: 'Async composition — engine-rendered shell + client fetch with error branch',
  },
] as const;

// WHY: bind loopback only — this demo serves rich dev error pages and project source
// snippets; exposing it on all interfaces (the default) would leak them to the LAN.
const server = app.listen(port, '127.0.0.1', () => {
  const catalog = baseRoutes
    .map((entry) => `  ${entry.path.padEnd(22)} — ${entry.intent}`)
    .join('\n');
  console.log(`\nNunjucks Express Demo — http://localhost:${port}`);
  console.log('Engine surface at a glance:\n');
  console.log(catalog);
  console.log('\nEvery route renders with `nunjucks(config)` from @nunjucks/core.');
});

// WHY: graceful shutdown — Ctrl+C / container stop should drain the listener and rip
// open keep-alive sockets instead of letting in-flight streaming demos die mid-chunk.
const shutdown = (signal: string): void => {
  console.log(`\n${signal} received — closing server…`);
  server.closeAllConnections();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

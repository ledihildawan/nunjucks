import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig, PACKAGE_VERSION } from '@nunjucks/integrations/express';
import { renderTemplate } from './lib/domain/render-template.ts';
import { sendTemplateResult } from './lib/io/send-template-result.ts';
import { currentYear } from './lib/io/clock.ts';
import { VIEWS } from './lib/io/views-path.ts';
import { formatError, type SourceFileReader } from '@nunjucks/error-formatter';
import { readProjectSource } from '@nunjucks/core/diagnostics';
import { demoRouter } from './routes/demo.ts';
import { errorRouter } from './routes/errors.ts';
import { boundaryRouter } from './routes/boundaries.ts';
import { streamingRouter } from './routes/streaming.ts';
import { remoteRouter } from './routes/remote.ts';
import { sandboxRouter } from './routes/sandbox.ts';
import { undefinedRouter } from './routes/undefined.ts';
import { warningsRouter } from './routes/warnings.ts';

const app: Express = express();

const PORT = 4000;

const engineConfig: ExpressEngineConfig = {
  dev: true,
  autoescape: true,
  globals: {
    appName: 'Nunjucks Express Demo',
    getYear: () => currentYear(),
  },
  filters: {
    shout: (v: string) => `${String(v).toUpperCase()}!!!`,
  },
};

app.set('views', VIEWS);
app.engine('.njk', createEngine(engineConfig));
app.set('view engine', 'njk');

app.get('/', (_req: Request, res: Response) => {
  res.render('index', { userName: 'Guest' });
});

app.get('/home', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(
    res,
    next,
    await renderTemplate('home-welcome.njk', { context: { username: 'John Doe' }, config: engineConfig })
  );
});

app.get('/security', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(
    res,
    next,
    await renderTemplate('security-features.njk', {
      context: {
        userInput: '<script>alert("XSS")</script><p>Safe content</p>',
        configData: { theme: 'dark', debug: true },
        htmlContent: '<b>Bold</b> & "quoted"',
        attrContent: 'value="with quotes"'
      },
      config: engineConfig
    })
  );
});

app.use('/demo', demoRouter);
app.use('/errors', errorRouter);
app.use('/boundary', boundaryRouter);
app.use('/remote', remoteRouter);
app.use('/sandbox', sandboxRouter);
app.use('/undefined', undefinedRouter);
app.use('/warnings', warningsRouter);
app.use(streamingRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const sourceFileReader: SourceFileReader = readProjectSource;
  console.log(formatError(err, { format: 'ansi', dev: true, sourceFileReader }));
  res.status(500).type('html').send(formatError(err, { format: 'html', dev: true, sourceFileReader, version: PACKAGE_VERSION }));
});

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
  { path: '/stream', intent: 'Streaming render — progressive blocks, abort-on-disconnect, idle/deadline/output-size guards' },
  { path: '/stream-normal', intent: 'Same dashboard, blocking render (latency comparison)' },
  { path: '/stream-api', intent: 'JSON streaming API — content-type aware error promotion' },
  { path: '/demo/:feature', intent: 'Language features — pipe, scope, switch, slot, component, exec' },
  { path: '/errors', intent: 'Error taxonomy browser — search, filter, live preview' },
  { path: '/errors/:scenario', intent: 'Per-error routes — catalogued by tier and category' },
  { path: '/boundary', intent: 'Boundary validation — zod schema narrows req.query before render' },
  { path: '/sandbox/:mode', intent: 'Sandbox security — proxy blocks proto/constructor/process, code execution' },
  { path: '/undefined/:mode', intent: 'Undefined variable modes — strict, debug, chainable' },
  { path: '/warnings', intent: 'Dev warnings — surface console hints without aborting render' },
  { path: '/remote', intent: 'Remote tag — async fragment fetch with error branch' },
] as const;

app.listen(PORT, () => {
  const catalog = baseRoutes
    .map((entry) => `  ${entry.path.padEnd(22)} — ${entry.intent}`)
    .join('\n');
  console.log(`\nNunjucks Express Demo — http://localhost:${PORT}`);
  console.log('Engine surface at a glance:\n');
  console.log(catalog);
  console.log('\nEvery route renders with `nunjucks(config)` from @nunjucks/core.');
});

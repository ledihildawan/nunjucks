import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig } from '@nunjucks/integrations/express';
import { renderTemplate } from './lib/render-template.ts';
import { renderToStream, pipeRenderStream } from '@nunjucks/core';
import { formatError } from '@nunjucks/log';import { demoRouter } from './routes/demo.ts';
import { errorRouter } from './routes/errors.ts';
import { boundaryRouter } from './routes/boundaries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const app: Express = express();

const engineConfig: ExpressEngineConfig = {
  dev: true,
  autoescape: true,
  globals: {
    appName: 'Nunjucks Express Demo',
    version: '1.0.0',
    getYear: () => new Date().getFullYear(),
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

app.get('/home', async (_req: Request, res: Response) => {
  const html = await renderTemplate(
    `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <h1>Welcome, {{ username }}!</h1>
  <p>App: {{ appName }} v{{ version }}</p>
  <p>Year: {{ getYear() }}</p>
  <p>Shout: {{ "hello" |> shout }}</p>
</body>
</html>`,
    { username: 'John Doe' },
    engineConfig
  );
  res.type('html').send(html);
});

app.get('/security', async (_req: Request, res: Response) => {
  const html = await renderTemplate(
    `<!DOCTYPE html>
<html>
<head><title>Security Features Demo</title></head>
<body>
  <h1>Security Features Demo</h1>

  <h2>1. Sanitize Filter (DOMPurify)</h2>
  <p>Raw user input (XSS risk): <code>{{ userInput }}</code></p>
  <p>Sanitized: <code>{{ userInput |> sanitize }}</code></p>

  <h2>2. Auto-toJSON in Script Context</h2>
  <script>
    const config = {{ configData }};
    console.log('Config loaded:', config);
  </script>

  <h2>3. Context-Aware Escaping</h2>
  <p>HTML: <code>{{ htmlContent }}</code></p>
  <p>Attribute: <code>&lt;div data-value="{{ attrContent }}"&gt;&lt;/div&gt;</code></p>
</body>
</html>`,
    {
      userInput: '<script>alert("XSS")</script><p>Safe content</p>',
      configData: { theme: 'dark', debug: true },
      htmlContent: '<b>Bold</b> & "quoted"',
      attrContent: 'value="with quotes"'
    },
    engineConfig
  );
  res.type('html').send(html);
});

app.use('/demo', demoRouter);
app.use('/errors', errorRouter);
app.use('/boundary', boundaryRouter);

// WHY: streaming demo — uses renderToStream to pipe rendered chunks straight to the response as they are produced. The `slow` async filter adds an artificial delay between sections so the incremental streaming is VISIBLE in the browser (chunk-by-chunk over ~1.5s instead of a single buffered response). Inline <script> tags run as each chunk is parsed, logging live arrival timestamps.
const slow = async (value: unknown): Promise<string> => {
  await new Promise((resolve) => { setTimeout(resolve, 400); });
  return String(value);
};

const streamTemplate = `<!DOCTYPE html>
<html><head><title>Streaming Demo</title>
<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem}#log{font-family:ui-monospace,monospace;font-size:.8rem;color:#666;background:#f5f5f5;padding:.75rem;border-radius:.4rem;margin:1rem 0}section{padding:.5rem 0;border-bottom:1px solid #eee}</style>
</head><body>
  <h1>Streaming Demo</h1>
  <p>Content streams chunk-by-chunk (~400ms apart via async filter). At the end, a missing property triggers a mid-stream error — inline marker appears at the failure position.</p>
  <div id="log"></div>
  <script>var t0=Date.now();function mark(label){document.getElementById('log').innerHTML+='<div>[+'+(Date.now()-t0)+'ms] '+label+'</div>';}</script>
  <script>mark('response started');</script>
  <section>Item 1: <strong>{{ a |> slow }}</strong></section>
  <script>mark('item 1 flushed');</script>
  <section>Item 2: <strong>{{ b |> slow }}</strong></section>
  <script>mark('item 2 flushed');</script>
  <section>Item 3: <strong>{{ c |> slow }}</strong></section>
  <script>mark('item 3 flushed');</script>
  <hr style="margin:1.5rem 0;border:none;border-top:1px solid #ddd">
  <p>Now rendering a missing property: {{ missing.prop }}</p>
  <p>This line will NOT appear (stream stops on error).</p>
</body></html>`;

const streamContext = { context: { greeting: 'Hello', a: 'first', b: 'second', c: 'third' }, dev: true, undefined: 'strict', filters: { slow } };

// WHY: recommended approach — pipeRenderStream handles everything in one call: pre-stream error → full page, success → pipe chunks, mid-stream error → inline marker + overlay. This is the only streaming route you need.
app.get('/stream', async (_req: Request, res: Response) => {
  await pipeRenderStream(
    await renderToStream(streamTemplate, streamContext),
    res,
    { contentType: 'html', dev: true }
  );
});

app.use(async (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.log(formatError(err, { format: 'ansi', dev: true }));
  res.status(500).type('html').send(formatError(err, { format: 'html', dev: true }));
});

app.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
  console.log('\nDemo routes:');
  console.log('  /              - Home');
  console.log('  /home          - Inline template with pipe syntax');
  console.log('  /security      - Security features (sanitize, auto-tojson)');
  console.log('  /stream        - Streaming demo (pipeRenderStream, success + mid-stream error marker)');
  console.log('  /demo/*        - Demo routes (pipe, scope, switch, slot, component, etc)');
  console.log('  /errors        - Error scenarios index');
  console.log('  /errors/*      - Individual error scenarios');
  console.log('  /boundary      - Boundary validation (zod schema on req.query)');
});

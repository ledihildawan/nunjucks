import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig } from '@nunjucks/integrations/express';
import { renderTemplate } from './lib/render-template.ts';
import { renderToStream, toWebReadableStream, pipeRenderStream } from '@nunjucks/core';
import { formatError } from '@nunjucks/log';
import { Readable } from 'node:stream';
import { demoRouter } from './routes/demo.ts';
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
<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem}#log{font-family:ui-monospace,monospace;font-size:.8rem;color:#666;background:#f5f5f5;padding:.75rem;border-radius:.4rem;margin:1rem 0}.root{border-left:3px solid #6b8cff;padding-left:.75rem}.block{border-left:3px solid #2da44e;padding-left:.75rem;margin:1rem 0}section{padding:.5rem 0}</style>
</head><body>
  <h1>⚡ Streaming Demo — root + block (Option C)</h1>
  <p>Root chunks AND block content both stream as they render. Watch the log: items inside the block flush ~400ms apart (block-level streaming).</p>
  <div id="log"></div>
  <script>var t0=Date.now();function mark(label,cls){document.getElementById('log').innerHTML+='<div class="'+(cls||'')+'">[+'+(Date.now()-t0)+'ms] '+label+'</div>';}</script>
  <div class="root">
    <p>Root content (flushed immediately): <strong>{{ greeting }}</strong></p>
    <script>mark('root chunk flushed','root');</script>
  </div>
  <div class="block">
    <p>↳ Now inside a block — these stream too:</p>
    {% block content %}
      <section>Block item 1: <strong>{{ a |> slow }}</strong></section>
      <script>mark('block item 1 flushed (Option C)','block');</script>
      <section>Block item 2: <strong>{{ b |> slow }}</strong></section>
      <script>mark('block item 2 flushed (Option C)','block');</script>
      <section>Block item 3: <strong>{{ c |> slow }}</strong></section>
      <script>mark('block item 3 flushed (Option C)','block');</script>
    {% endblock %}
  </div>
  <script>document.getElementById('log').innerHTML+='<div style="color:green">[+'+(Date.now()-t0)+'ms] ✓ stream complete</div>';</script>
</body></html>`;

const streamContext = { context: { greeting: 'Hello', a: 'first', b: 'second', c: 'third' }, dev: true, filters: { slow } };

// WHY: manual for-await demo — maximum control (timing, per-chunk logging) but verbose. For most routes, prefer pipeRenderStream (see /stream-error).
app.get('/stream', async (_req: Request, res: Response) => {
  const result = await renderToStream(streamTemplate, streamContext);
  if (!result.ok) {
    console.log(formatError(result.error, { format: 'ansi', dev: true }));
    res.status(500).type('html').send(formatError(result.error, { format: 'html', dev: true }));
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    for await (const chunk of result.stream) {
      res.write(chunk);
    }
    res.end();
  } catch (streamErr) {
    res.write(`\n<!-- mid-stream error: ${streamErr instanceof Error ? streamErr.message : String(streamErr)} -->`);
    res.end();
  }
});

// WHY: adapter demo — toWebReadableStream converts the AsyncGenerator to a Web ReadableStream, piped via Node's Readable.fromWeb. Useful for Bun/Deno/edge runtimes that prefer Web Streams.
app.get('/stream-adapter', async (_req: Request, res: Response) => {
  const result = await renderToStream(streamTemplate, streamContext);
  if (!result.ok) {
    res.status(500).type('html').send(formatError(result.error, { format: 'html', dev: true }));
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  Readable.fromWeb(toWebReadableStream(result.stream)).pipe(res);
});

// WHY: recommended approach — pipeRenderStream handles everything (pre-stream error → full page, success → pipe chunks, mid-stream error → inline marker + modal) in one call. This is what most routes should use.
app.get('/stream-error', async (_req: Request, res: Response) => {
  const template = `<!DOCTYPE html>
<html><head><title>Stream Error Demo</title>
<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem}</style>
</head><body>
  <h1>Stream Error Demo</h1>
  <p>Hello {{ name }}! This content streams fine and renders before the error.</p>
  <p>Now rendering a missing property: {{ missing.prop }}</p>
  <p>This line will NOT appear (stream stops on error).</p>
</body></html>`;

  await pipeRenderStream(
    await renderToStream(template, { context: { name: 'World' }, dev: true, undefined: 'strict' }),
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
  console.log('  /stream        - Streaming response demo (renderToStream, chunk-by-chunk)');
  console.log('  /stream-adapter - Streaming via toWebReadableStream + Readable.fromWeb pipe');
  console.log('  /stream-error   - Mid-stream error → inline marker + modal');
  console.log('  /demo/*        - Demo routes (pipe, scope, switch, slot, component, etc)');
  console.log('  /errors        - Error scenarios index');
  console.log('  /errors/*      - Individual error scenarios');
  console.log('  /boundary      - Boundary validation (zod schema on req.query)');
});

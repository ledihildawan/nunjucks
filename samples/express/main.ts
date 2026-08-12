import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig } from '@nunjucks/integrations/express';
import { renderTemplate, sendTemplateResult } from './lib/express-render.ts';
import { currentYear } from './lib/clock.ts';
import { formatError } from '@nunjucks/error-formatter';
import { demoRouter } from './routes/demo.ts';
import { errorRouter } from './routes/errors.ts';
import { boundaryRouter } from './routes/boundaries.ts';
import { streamingRouter } from './routes/streaming.ts';
import { remoteRouter } from './routes/remote.ts';
import { sandboxRouter } from './routes/sandbox.ts';
import { undefinedRouter } from './routes/undefined.ts';
import { warningsRouter } from './routes/warnings.ts';

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
    await renderTemplate(
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
      { context: { username: 'John Doe' }, config: engineConfig }
    )
  );
});

app.get('/security', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(
    res,
    next,
    await renderTemplate(
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
        context: {
          userInput: '<script>alert("XSS")</script><p>Safe content</p>',
          configData: { theme: 'dark', debug: true },
          htmlContent: '<b>Bold</b> & "quoted"',
          attrContent: 'value="with quotes"'
        },
        config: engineConfig
      }
    )
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
  console.log('  /stream        - Streaming dashboard (extends+blocks, error recovery, metrics)');
  console.log('  /stream-normal - Same dashboard, blocking render (compare side-by-side)');
  console.log('  /stream-api    - JSON streaming API (content-type aware error markers)');
  console.log('  /demo/*        - Demo routes (pipe, scope, switch, slot, component, etc)');
  console.log('  /errors        - Error scenarios index');
  console.log('  /errors/*      - Individual error scenarios');
  console.log('  /boundary      - Boundary validation (zod schema on req.query)');
  console.log('  /sandbox/*      - Sandbox security demos');
  console.log('  /undefined/*    - Undefined variable handling demos');
  console.log('  /warnings      - Warnings demo');
  console.log('  /remote/*      - Remote extension demo');
});

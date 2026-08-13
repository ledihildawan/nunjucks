import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig } from '@nunjucks/integrations/express';
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

app.use(async (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const sourceFileReader: SourceFileReader = readProjectSource;
  console.log(formatError(err, { format: 'ansi', dev: true, sourceFileReader }));
  res.status(500).type('html').send(formatError(err, { format: 'html', dev: true, sourceFileReader }));
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

import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine } from '../../src/integrations/express.js';
import nunjucks from '../../src/index.js';

import { errorRouter, errorRoutes } from './routes/errors.ts';
import { sandboxRouter } from './routes/sandbox.ts';
import { undefinedRouter } from './routes/undefined.ts';
import { remoteRouter } from './routes/remote.ts';
import { demoRouter } from './routes/demo.ts';
import { warningsRouter } from './routes/warnings.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const app: Express = express();

app.set('views', VIEWS);
app.engine('.njk', createEngine({
  autoescape: true,
  dev: true,
  undefined: 'strict'
}));
app.set('view engine', 'njk');

app.use('/errors', errorRouter);
app.use('/sandbox', sandboxRouter);
app.use('/undefined', undefinedRouter);

console.log('remoteRouter routes:', remoteRouter.stack.map((l: { route?: { path?: string } }) => l.route?.path));
app.use('/remote', remoteRouter);

app.use('/demo', demoRouter);
app.use('/warnings', warningsRouter);

app.get('/file-error', (req: Request, res: Response) => {
  res.render('test_error', {});
});

app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(await (err as { output?: (opts: { format: string }) => Promise<string> }).output?.({ format: 'ansi' }));
  res.status(500).type('html').send(await (err as { output?: () => Promise<string> }).output?.());
});

app.get('/', async (req: Request, res: Response) => {
  const html = await nunjucks.render('index.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

app.get('/home', async (req: Request, res: Response) => {
  const template = `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <h1>Welcome, {{ username }}!</h1>
  <h2>Items:</h2>
  <ul>
  {% for item in items %}
    <li>{{ item }}</li>
  {% endfor %}
  </ul>
</body>
</html>`;

  const html = await nunjucks(template, {
    username: 'John Doe',
    items: ['Apple', 'Banana', 'Cherry']
  }, { dev: true });

  res.type('html').send(html);
});

app.get('/info', (req: Request, res: Response) => {
  res.type('html').send(`<!DOCTYPE html>
<html>
<head><title>Environment Info</title></head>
<body>
  <h1>Environment Info</h1>
  <p>Nunjucks 2026 Style API</p>
  <p><a href="/">Back to Index</a></p>
</body>
</html>`);
});

app.listen(4000, () => {
  console.log('Nunjucks Error Classification Demo: http://localhost:4000');
  console.log('Run: node --watch samples/express/main.ts');
});

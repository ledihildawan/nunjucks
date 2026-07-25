import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine } from '@nunjucks/core/express';
import { render } from '@nunjucks/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const app: Express = express();

const engineConfig = {
  dev: true,
  autoescape: true,
  globals: {
    appName: 'Nunjucks Express Demo',
    version: '1.0.0',
    getYear: () => new Date().getFullYear(),
  },
  filters: {
    shout: (v: string) => String(v).toUpperCase() + '!!!',
  },
};

app.set('views', VIEWS);
app.engine('.njk', createEngine(engineConfig));
app.set('view engine', 'njk');

app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(await (err as { output?: (opts: { format: string }) => Promise<string> }).output?.({ format: 'ansi' }));
  res.status(500).type('html').send(await (err as { output?: () => Promise<string> }).output?.());
});

app.get('/', (req: Request, res: Response) => {
  res.render('index', { userName: 'Guest' });
});

app.get('/home', async (req: Request, res: Response) => {
  const html = await render(
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

app.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
});

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

app.get('/security', async (req: Request, res: Response) => {
  const html = await render(
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

app.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
  console.log('Demo routes:');
  console.log('  /         - Home');
  console.log('  /home     - Inline template with pipe syntax');
  console.log('  /security - Security features (sanitize, auto-tojson, context-aware escaping)');
});

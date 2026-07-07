import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../nunjucks/index.js';
import express from 'express';
import { errorRouter, errorRoutes } from './routes/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');

const app = express();

const fsLoader = new nunjucks.FileSystemLoader(VIEWS);

const envDev = new nunjucks.Environment(fsLoader, {
  autoescape: true,
  dev: true,
  throwOnUndefined: true
});

app.use('/errors', errorRouter);

app.get('/', (req, res) => {
  const routesList = errorRoutes.map(r =>
    `      <tr>
        <td><code>${r.category}</code></td>
        <td><a href="/errors${r.path}">/errors${r.path}</a></td>
        <td>${r.desc}</td>
      </tr>`
  ).join('\n');

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Nunjucks Error Classification Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #e74c3c; }
    h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
    th { background: #3498db; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .info { background: #ecf0f1; padding: 15px; border-radius: 8px; margin: 20px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    .nav { margin: 20px 0; }
    .nav a { display: inline-block; padding: 10px 15px; background: #3498db; color: white; border-radius: 5px; margin-right: 10px; }
    .nav a:hover { background: #2980b9; }
  </style>
</head>
<body>
  <h1>🔧 Nunjucks Error Classification Demo</h1>

  <div class="info">
    <p><strong>9 Error Categories</strong> - Click any route to see the error in action with full classification and fix suggestions.</p>
  </div>

  <h2>📋 Error Categories</h2>
  <table>
    <tr>
      <th>Category</th>
      <th>Route</th>
      <th>Description</th>
    </tr>
${routesList}
  </table>

  <h2>🧪 Also Try</h2>
  <div class="nav">
    <a href="/home">/home - Normal render</a>
    <a href="/info">/info - Environment info</a>
  </div>

  <h2>📚 How It Works</h2>
  <ul>
    <li><strong>throwOnUndefined</strong>: Enabled in dev mode for all error routes</li>
    <li><strong>Auto-detect</strong>: Dev vs production mode based on error.lineno presence</li>
    <li><strong>Stack filtering</strong>: Internal nunjucks frames hidden in production</li>
    <li><strong>Dynamic fix suggestions</strong>: Based on error category</li>
  </ul>

  <footer style="margin-top: 40px; color: #7f8c8d;">
    <p>Nunjucks Error Handler Demo | Run: <code>node --watch samples/express/main.js</code></p>
  </footer>
</body>
</html>
  `);
});

app.get('/home', async (req, res) => {
  try {
    const html = await envDev.render('home.html', {
      username: 'John Doe',
      items: ['Apple', 'Banana', 'Cherry']
    });
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send('<h1>Error</h1><pre>' + e.message + '</pre>');
  }
});

app.get('/info', (req, res) => {
  const globals = Object.keys(envDev.globals || {});
  const filters = Object.keys(envDev.filters || {});
  const tests = Object.keys(envDev.tests || {});

  res.type('html').send(`
<!DOCTYPE html>
<html>
<head><title>Environment Info</title></head>
<body>
  <h1>Environment Info</h1>
  <h2>Globals (${globals.length})</h2>
  <ul>${globals.map(g => `<li>${g}</li>`).join('')}</ul>
  <h2>Filters (${filters.length})</h2>
  <ul>${filters.map(f => `<li>${f}</li>`).join('')}</ul>
  <h2>Tests (${tests.length})</h2>
  <ul>${tests.map(t => `<li>${t}</li>`).join('')}</ul>
  <p><a href="/">← Back to Index</a></p>
</body>
</html>
  `);
});

app.listen(4000, () => {
  console.log('Nunjucks Error Classification Demo: http://localhost:4000');
  console.log('Run: node --watch samples/express/main.js');
});
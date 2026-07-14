import path from 'path';
import { fileURLToPath } from 'url';
import { createEngine } from '../../src/index.js';
import express from 'express';
import { errorRouter, errorRoutes } from './routes/errors.js';
import { sandboxRouter } from './routes/sandbox.js';
import { undefinedRouter } from './routes/undefined.js';
import { remoteRouter } from './routes/remote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');

const app = express();

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

console.log('remoteRouter routes:', remoteRouter.stack.map(l => l.route?.path));

app.use('/remote', remoteRouter);

app.get('/file-error', (req, res, next) => {
  res.render('test_error', {});
});

app.use((err, req, res, next) => {
  if (err.toHtmlString) {
    res.status(500).type('html').send(err.toHtmlString());
  } else {
    res.status(500).type('html').send(err.message);
  }
});

app.get('/', (req, res) => {
  const routesList = errorRoutes.map(r =>
    `      <tr>
        <td><code>${r.category}</code></td>
        <td><a href="/errors${r.path}">/errors${r.path}</a></td>
        <td>${r.desc}</td>
      </tr>`
  ).join('\n');

  const extendsIncludeRoutes = `
      <tr>
        <td><code>extends_error</code></td>
        <td><a href="/errors/undefined-block">/errors/undefined-block</a></td>
        <td>Block not in parent template (extends)</td>
      </tr>
      <tr>
        <td><code>extends_error</code></td>
        <td><a href="/errors/no-super-block">/errors/no-super-block</a></td>
        <td>super() called without parent block</td>
      </tr>
      <tr>
        <td><code>include_error</code></td>
        <td><a href="/errors/invalid-include">/errors/invalid-include</a></td>
        <td>Non-string template name for include</td>
      </tr>
      <tr>
        <td><code>include_error</code></td>
        <td><a href="/errors/circular-include">/errors/circular-include</a></td>
        <td>Template includes itself</td>
      </tr>
      <tr>
        <td><code>include_error</code></td>
        <td><a href="/errors/file-not-found">/errors/file-not-found</a></td>
        <td>Included template not found</td>
      </tr>
      <tr>
        <td><code>filesystem_error</code></td>
        <td><a href="/errors/filesystem-error">/errors/filesystem-error</a></td>
        <td>Absolute path with non-existent file</td>
      </tr>
  `;

  const extraRoutes = `
      <tr>
        <td><code>inline_error</code></td>
        <td><a href="/errors/inline-error">/errors/inline-error</a></td>
        <td>render with undefined variable</td>
      </tr>
      <tr>
        <td><code>sandbox_blocked</code></td>
        <td><a href="/errors/sandbox-proto">/errors/sandbox-proto</a></td>
        <td>Sandbox blocks __proto__ access</td>
      </tr>
      <tr>
        <td><code>sandbox_blocked</code></td>
        <td><a href="/errors/sandbox-constructor">/errors/sandbox-constructor</a></td>
        <td>Sandbox blocks constructor access</td>
      </tr>
      <tr>
        <td><code>sandbox_blocked</code></td>
        <td><a href="/errors/sandbox-process">/errors/sandbox-process</a></td>
        <td>Sandbox blocks process access</td>
      </tr>
      <tr>
        <td><code>slice_error</code></td>
        <td><a href="/errors/slice-error">/errors/slice-error</a></td>
        <td>Slice step cannot be zero</td>
      </tr>
      <tr>
        <td><code>iterable_error</code></td>
        <td><a href="/errors/list-filter-error">/errors/list-filter-error</a></td>
        <td>List filter requires iterable</td>
      </tr>
      <tr>
        <td><code>operator_error</code></td>
        <td><a href="/errors/in-operator-error">/errors/in-operator-error</a></td>
        <td>In operator on primitive type</td>
      </tr>
      <tr>
        <td><code>filter_error</code></td>
        <td><a href="/errors/filter-throw">/errors/filter-throw</a></td>
        <td>Filter throws during execution</td>
      </tr>
      <tr>
        <td><code>undefined_value</code></td>
        <td><a href="/undefined/strict">/undefined/strict</a></td>
        <td>Undefined variable (strict mode)</td>
      </tr>
      <tr>
        <td><code>undefined_value</code></td>
        <td><a href="/undefined/strict-nested">/undefined/strict-nested</a></td>
        <td>Nested property is null (strict)</td>
      </tr>
      <tr>
        <td><code>undefined_value</code></td>
        <td><a href="/undefined/strict-array">/undefined/strict-array</a></td>
        <td>Array index out of bounds (strict)</td>
      </tr>
  `;

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Nunjucks Error Classification Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; }
    h1 { color: #e74c3c; }
    h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    h3 { color: #3498db; margin-top: 30px; }
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
  <h1>Nunjucks Error Classification Demo</h1>

  <div class="info">
    <p><strong>25+ Error Categories</strong> - Click any route to see the error in action with full classification, causes, and fix suggestions.</p>
  </div>

  <h2>Template Errors (from files)</h2>
  <table>
    <tr>
      <th>Category</th>
      <th>Route</th>
      <th>Description</th>
    </tr>
  ${routesList}
  </table>

  <h2>Extends/Include Errors (requires full environment)</h2>
  <table>
    <tr>
      <th>Category</th>
      <th>Route</th>
      <th>Description</th>
    </tr>
  ${extendsIncludeRoutes}
  </table>

  <h2>Inline Errors (from render)</h2>
  <table>
    <tr>
      <th>Category</th>
      <th>Route</th>
      <th>Description</th>
    </tr>
  ${extraRoutes}
  </table>

  <h2>Also Try</h2>
  <div class="nav">
    <a href="/home">/home - Normal render</a>
    <a href="/info">/info - Environment info</a>
    <a href="/sandbox">/sandbox - Sandbox Demo</a>
    <a href="/undefined">/undefined - Undefined Types</a>
    <a href="/remote">/remote - Remote Extension</a>
  </div>

  <h2>New Features (2026 Style)</h2>
  <div class="nav">
    <a href="/demo/try-catch">/demo/try-catch - Try/Catch block</a>
    <a href="/demo/with">/demo/with - With scoped variables</a>
    <a href="/demo/do">/demo/do - Do statement</a>
    <a href="/demo/switch">/demo/switch - Switch statement</a>
    <a href="/demo/call">/demo/call - Call/Caller</a>
    <a href="/demo/pipe">/demo/pipe - Pipe forward (|>)</a>
  </div>

  <h2>How It Works</h2>
  <ul>
    <li><strong>undefined: 'strict'</strong>: Error on undefined (formerly throwOnUndefined: true)</li>
    <li><strong>undefined: 'debug'</strong>: Warning + "undefined" string</li>
    <li><strong>undefined: 'chainable'</strong>: Silent "undefined" (default)</li>
    <li><strong>Sandbox Mode</strong>: Block dangerous template access</li>
    <li><strong>Auto-detect</strong>: Dev vs production mode based on error.lineno presence</li>
    <li><strong>Stack filtering</strong>: Internal nunjucks frames hidden in production</li>
    <li><strong>JS Source Detection</strong>: Shows JS caller location for render errors</li>
  </ul>

  <footer style="margin-top: 40px; color: #7f8c8d;">
    <p>Nunjucks Error Handler Demo | Run: <code>node --watch samples/express/main.js</code></p>
  </footer>
</body>
</html>
  `);
});

app.get('/home', (req, res) => {
  res.render('home', {
    username: 'John Doe',
    items: ['Apple', 'Banana', 'Cherry']
  });
});

app.get('/info', (req, res) => {
  res.type('html').send(`
<!DOCTYPE html>
<html>
<head><title>Environment Info</title></head>
<body>
  <h1>Environment Info</h1>
  <p>Nunjucks 2026 Style API</p>
  <p><a href="/">Back to Index</a></p>
</body>
</html>
  `);
});

app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/demo/try-catch', (req, res) => {
  res.render('demo-try-catch', {
    arr: [],
    name: { append: function(x) { return this.value + x; }, value: "Hello" },
    items: []
  });
});

app.get('/demo/with', (req, res) => {
  res.render('demo-with', {});
});

app.get('/demo/do', (req, res) => {
  res.render('demo-do', {
    arr: [],
    name: { append: function(x) { return this.value + x; }, value: "Hello" },
    items: []
  });
});

app.get('/demo/switch', (req, res) => {
  res.render('demo-switch', {
    status: "active",
    priority: 2
  });
});

app.get('/demo/call', (req, res) => {
  res.render('demo-call', {});
});

app.get('/demo/pipe', (req, res) => {
  res.render('demo-pipe', {
    items: ["one", "two", "three"]
  });
});

app.listen(4000, () => {
  console.log('Nunjucks Error Classification Demo: http://localhost:4000');
  console.log('Run: node --watch samples/express/main.js');
});

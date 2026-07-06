import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../nunjucks/index.js';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');
const DB_PATH = path.join(__dirname, 'views', 'templates.db');

const app = express();

const sqliteLoader = new nunjucks.BunSQLitePrecompiledLoader(DB_PATH, {
  mode: 'development'
});

const envDev = new nunjucks.Environment(sqliteLoader, {
  autoescape: true
});

sqliteLoader.setMode('development');
const envProd = new nunjucks.Environment(new nunjucks.BunSQLitePrecompiledLoader(DB_PATH, {
  mode: 'production'
}), {
  autoescape: true
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Nunjucks Dual-Mode Error Handler Demo</h1>
    <h2>How it works:</h2>
    <ul>
      <li><strong>Development Mode:</strong> Full error context with code snippets, line numbers, include chain</li>
      <li><strong>Production Mode:</strong> Safe error ID only - no source code or paths leaked</li>
    </ul>
    <h2>Available Routes:</h2>
    <ul>
      <li><a href="/dev/home">/dev/home - Dev Mode: Normal render</a></li>
      <li><a href="/prod/home">/prod/home - Prod Mode: Normal render</a></li>
      <li><a href="/dev/error">/dev/error - Dev Mode: Error with full context</a></li>
      <li><a href="/dev/include-error">/dev/include-error - Dev Mode: Include chain error</a></li>
      <li><a href="/prod/error">/prod/error - Prod Mode: Safe error (no leakage)</a></li>
      <li><a href="/db-info">/db-info - View SQLite metadata (UUIDs)</a></li>
    </ul>
  `);
});

app.get('/dev/home', async (req, res) => {
  try {
    const html = await envDev.render('home.html', {
      username: 'John Doe',
      items: ['Apple', 'Banana', 'Cherry']
    });
    res.send(html);
  } catch (e) {
    const formatted = await sqliteLoader.formatError(e, 'home.html');
    res.status(500).send(`<pre>${escapeHtml(formatted.toVisualString())}</pre>`);
  }
});

app.get('/prod/home', async (req, res) => {
  try {
    const html = await envProd.render('home.html', {
      username: 'John Doe',
      items: ['Apple', 'Banana', 'Cherry']
    });
    res.send(html);
  } catch (e) {
    const loader = envProd.loaders[0];
    const formatted = await loader.formatError(e, 'home.html');
    res.status(500).send(`<pre>${escapeHtml(formatted.toSafeString())}</pre>`);
  }
});

app.get('/dev/error', async (req, res) => {
  try {
    const html = await envDev.render('error-partial.html');
    res.send(html);
  } catch (e) {
    const loader = envDev.loaders[0];
    const formatted = await loader.formatError(e, 'error-partial.html');
    res.status(500).send(`
      <h1 style="color: red;">Dev Mode Error</h1>
      <p>This error shows full context including code snippet and include chain.</p>
      <hr>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${escapeHtml(formatted.toVisualString())}</pre>
    `);
  }
});

app.get('/dev/include-error', async (req, res) => {
  try {
    const html = await envDev.render('error-include.html');
    res.send(html);
  } catch (e) {
    const loader = envDev.loaders[0];
    const formatted = await loader.formatError(e, 'error-include.html');
    res.status(500).send(`
      <h1 style="color: red;">Dev Mode Error - Include Chain</h1>
      <p>This error shows the include chain - which template included which.</p>
      <hr>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${escapeHtml(formatted.toVisualString())}</pre>
    `);
  }
});

app.get('/prod/error', async (req, res) => {
  try {
    const html = await envProd.render('error-partial.html');
    res.send(html);
  } catch (e) {
    const loader = envProd.loaders[0];
    const formatted = await loader.formatError(e, 'error-partial.html');
    res.status(500).send(`
      <h1 style="color: red;">Production Mode Error</h1>
      <p>This error is safe - no source code or internal paths are leaked.</p>
      <hr>
      <pre style="background: #ffdddd; padding: 10px; border-radius: 5px; color: #990000;">${escapeHtml(formatted.toSafeString())}</pre>
      <hr>
      <h3>What happened?</h3>
      <ul>
        <li>The error was logged internally with template ID</li>
        <li>Client received only a safe error ID</li>
        <li>Use the template ID to search logs for details</li>
      </ul>
    `);
  }
});

app.get('/db-info', async (req, res) => {
  try {
    const { Database } = require('bun:sqlite');
    const db = new Database(DB_PATH);

    const metaResult = db.query("SELECT name, category, linesOfCode FROM _template_meta").all();
    const uuidResult = db.query("SELECT name, uuid FROM _compiled_templates").all();
    const uuidMap = {};
    uuidResult.forEach(r => uuidMap[r.name] = r.uuid);

    const templates = metaResult.map(m => ({
      name: m.name,
      uuid: uuidMap[m.name] || 'N/A',
      category: m.category,
      linesOfCode: m.linesOfCode
    }));

    const sourcemaps = db.query("SELECT name, COUNT(*) as count FROM _sourcemaps GROUP BY name LIMIT 5").all();

    db.close();

    res.send(`
      <h1>SQLite Database Info</h1>
      <h2>Templates (${templates.length}) - UUIDs for error tracking</h2>
      <table border="1" cellpadding="5">
        <tr><th>Name</th><th>UUID</th><th>Category</th><th>Lines</th></tr>
        ${templates.map(t => `<tr><td>${t.name}</td><td><code>${t.uuid}</code></td><td>${t.category}</td><td>${t.linesOfCode}</td></tr>`).join('')}
      </table>
      <h2>Sourcemap Entries</h2>
      <ul>
        ${sourcemaps.map(s => `<li>${s.name}: ${s.count} mappings</li>`).join('')}
      </ul>
    `);
  } catch (e) {
    res.status(500).send(`DB info failed: ${e.message}<br><pre>${e.stack}</pre>`);
  }
});

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(4000, () => {
  console.log('Dual-Mode Error Handler Demo running on http://localhost:4000');
  console.log('Try these routes:');
  console.log('  /dev/home   - Dev mode: normal render');
  console.log('  /prod/home  - Prod mode: normal render');
  console.log('  /dev/error  - Dev mode: error with full context');
  console.log('  /prod/error - Prod mode: safe error (no leakage)');
  console.log('  /db-info    - View SQLite metadata (UUIDs)');
});

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import nunjucks from '../../nunjucks/index.js';
import { createErrorFormatter, classifyError } from '../../nunjucks/src/error/index.js';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');

const app = express();

const fsLoader = new nunjucks.FileSystemLoader(VIEWS);

const envDev = new nunjucks.Environment(fsLoader, {
  autoescape: true,
  dev: true,
  throwOnUndefined: true
});

// Pre-register a failing async filter for testing
envDev.addFilter('failingAsync', async function(val) {
  throw new Error('Async filter failed: network error');
}, true);

const errorFormatter = createErrorFormatter();

async function renderWithErrorHandler(res, templateName, env, context = {}) {
  try {
    const html = await env.render(templateName, context);
    res.type('html').send(html);
  } catch (e) {
    const classified = classifyError(e.message.split('\n').pop()?.trim() || e.message);
    const formatted = await errorFormatter.formatError(e, templateName, e._includeChain, path.join(VIEWS, templateName));
    console.error(`[${classified?.category || 'unknown'}]`, formatted.toConsoleString());
    res.type('html').status(500).send(formatted.toHtmlString());
  }
}

app.get('/', (req, res) => {
  res.send(`
    <h1>Nunjucks Error Classification Demo</h1>
    <p>Error Handler with 13 classification categories</p>
    <h2>Error Categories:</h2>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>Category</th><th>Route</th><th>Description</th></tr>
      <tr><td><code>undefined_variable</code></td><td><a href="/errors/undefined-variable">/errors/undefined-variable</a></td><td>Variable not passed in context</td></tr>
      <tr><td><code>undefined_function</code></td><td><a href="/errors/undefined-function">/errors/undefined-function</a></td><td>Function not registered with addGlobal()</td></tr>
      <tr><td><code>not_a_function</code></td><td><a href="/errors/not-a-function">/errors/not-a-function</a></td><td>Calling a non-function value</td></tr>
      <tr><td><code>undefined_filter</code></td><td><a href="/errors/undefined-filter">/errors/undefined-filter</a></td><td>Filter not registered with addFilter()</td></tr>
      <tr><td><code>filter_error</code></td><td><a href="/errors/filter-error">/errors/filter-error</a></td><td>Filter throws during execution</td></tr>
      <tr><td><code>undefined_value</code></td><td><a href="/errors/undefined-value">/errors/undefined-value</a></td><td>Nested property access returns null/undefined</td></tr>
      <tr><td><code>syntax_error</code></td><td><a href="/errors/syntax-error">/errors/syntax-error</a></td><td>Template syntax is invalid</td></tr>
      <tr><td><code>undefined_block</code></td><td><a href="/errors/undefined-block">/errors/undefined-block</a></td><td>Block not found in parent template</td></tr>
      <tr><td><code>no_super_block</code></td><td><a href="/errors/no-super-block">/errors/no-super-block</a></td><td>super() called but no parent block</td></tr>
      <tr><td><code>circular_include</code></td><td><a href="/errors/circular-include">/errors/circular-include</a></td><td>Template includes itself</td></tr>
      <tr><td><code>file_not_found</code></td><td><a href="/errors/file-not-found">/errors/file-not-found</a></td><td>Template file does not exist</td></tr>
      <tr><td><code>invalid_include</code></td><td><a href="/errors/invalid-include">/errors/invalid-include</a></td><td>Include path is not a string</td></tr>
      <tr><td><code>filesystem_error</code></td><td><a href="/errors/filesystem-error">/errors/filesystem-error</a></td><td>OS filesystem error</td></tr>
    </table>
    <h2>Also Try:</h2>
    <ul>
      <li><a href="/home">/home</a> - Normal render (no error)</li>
      <li><a href="/info">/info</a> - Show all registered globals, filters, tests</li>
    </ul>
  `);
});

app.get('/home', async (req, res) => {
  await renderWithErrorHandler(res, 'home.html', envDev, {
    username: 'John Doe',
    items: ['Apple', 'Banana', 'Cherry']
  });
});

app.get('/info', (req, res) => {
  const globals = Object.keys(envDev.globals || {});
  const filters = Object.keys(envDev.filters || {});
  const tests = Object.keys(envDev.tests || {});

  res.send(`
    <h1>Environment Info</h1>
    <h2>Globals (${globals.length})</h2>
    <ul>${globals.map(g => `<li>${g}</li>`).join('')}</ul>
    <h2>Filters (${filters.length})</h2>
    <ul>${filters.map(f => `<li>${f}</li>`).join('')}</ul>
    <h2>Tests (${tests.length})</h2>
    <ul>${tests.map(t => `<li>${t}</li>`).join('')}</ul>
  `);
});

// ==================== ERROR ROUTES ====================

app.get('/errors/undefined-variable', async (req, res) => {
  await renderWithErrorHandler(res, 'error-undefined-variable.html', envDev);
});

app.get('/errors/undefined-function', async (req, res) => {
  await renderWithErrorHandler(res, 'error-undefined-function.html', envDev);
});

app.get('/errors/not-a-function', async (req, res) => {
  await renderWithErrorHandler(res, 'error-not-a-function.html', envDev);
});

app.get('/errors/undefined-filter', async (req, res) => {
  await renderWithErrorHandler(res, 'error-undefined-filter.html', envDev);
});

app.get('/errors/filter-error', async (req, res) => {
  await renderWithErrorHandler(res, 'error-filter-error.html', envDev);
});

app.get('/errors/undefined-value', async (req, res) => {
  await renderWithErrorHandler(res, 'error-undefined-value.html', envDev);
});

app.get('/errors/syntax-error', async (req, res) => {
  await renderWithErrorHandler(res, 'error-syntax-error.html', envDev);
});

app.get('/errors/undefined-block', async (req, res) => {
  await renderWithErrorHandler(res, 'error-undefined-block.html', envDev);
});

app.get('/errors/no-super-block', async (req, res) => {
  await renderWithErrorHandler(res, 'error-no-super-block.html', envDev);
});

app.get('/errors/circular-include', async (req, res) => {
  await renderWithErrorHandler(res, 'error-circular-include.html', envDev);
});

app.get('/errors/file-not-found', async (req, res) => {
  await renderWithErrorHandler(res, 'error-file-not-found.html', envDev);
});

app.get('/errors/invalid-include', async (req, res) => {
  await renderWithErrorHandler(res, 'error-invalid-include.html', envDev);
});

app.get('/errors/filesystem-error', async (req, res) => {
  await renderWithErrorHandler(res, 'error-filesystem-error.html', envDev);
});

app.listen(4000, () => {
  console.log('Nunjucks Error Classification Demo: http://localhost:4000');
  console.log('Run: node --watch samples/express/main.js');
});
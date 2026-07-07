import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import nunjucks from '../../nunjucks/index.js';
import { createErrorFormatter } from '../../nunjucks/src/error/index.js';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');

const app = express();

// FileSystemLoader for ALL environments - simple, fast, works with throwOnUndefined
const fsLoader = new nunjucks.FileSystemLoader(VIEWS);

// Dev environment
const envDev = new nunjucks.Environment(fsLoader, {
  autoescape: true,
  dev: true,
  throwOnUndefined: true
});

// Prod environment (same loader, no SQLite)
const envProd = new nunjucks.Environment(fsLoader, {
  autoescape: true
});

// Error formatter with auto-detect dev vs production
const errorFormatter = createErrorFormatter();

// Helper to read source from filesystem
function getTemplateSource(templateName) {
  try {
    const fullPath = path.join(VIEWS, templateName);
    return readFileSync(fullPath, 'utf-8');
  } catch (e) {
    return null;
  }
}

app.get('/', (req, res) => {
  res.send(`
    <h1>Nunjucks Error Handler Demo</h1>
    <h2>Features:</h2>
    <ul>
      <li><strong>throwOnUndefined:</strong> Catches undefined variable references</li>
      <li><strong>Include Chain:</strong> Tracks nested template errors</li>
      <li><strong>Source Preview:</strong> Shows error context with line numbers</li>
      <li><strong>Stack Trace:</strong> Real execution stack from JavaScript</li>
    </ul>
    <h2>Routes:</h2>
    <ul>
      <li><a href="/home">/home - Normal render</a></li>
      <li><a href="/error">/error - Direct template error</a></li>
      <li><a href="/include-error">/include-error - Include chain error</a></li>
    </ul>
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
    const formatted = await errorFormatter.formatError(e, 'home.html', null, path.join(VIEWS, 'home.html'));
    console.error(formatted.toConsoleString());
    res.type('html').status(500).send(formatted.toHtmlString());
  }
});

app.get('/error', async (req, res) => {
  try {
    const html = await envDev.render('error-partial.html');
    res.type('html').send(html);
  } catch (e) {
    const formatted = await errorFormatter.formatError(e, 'error-partial.html', null, path.join(VIEWS, 'error-partial.html'));
    console.error(formatted.toConsoleString());
    res.type('html').status(500).send(formatted.toHtmlString());
  }
});

app.get('/include-error', async (req, res) => {
  try {
    const html = await envDev.render('error-include.html');
    res.type('html').send(html);
  } catch (e) {
    const formatted = await errorFormatter.formatError(e, 'error-include.html', e._includeChain, path.join(VIEWS, 'error-partial.html'));
    console.error(formatted.toConsoleString());
    res.type('html').status(500).send(formatted.toHtmlString());
  }
});

app.listen(4000, () => {
  console.log('Nunjucks Error Handler Demo running on http://localhost:4000');
  console.log('Routes:');
  console.log('  /home         - Normal render');
  console.log('  /error        - Direct template error');
  console.log('  /include-error - Include chain error');
});

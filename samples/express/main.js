import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../nunjucks/index.js';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'views');

const app = express();
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(VIEWS), {
  autoescape: true
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Nunjucks Demo App</h1>
    <h2>Available Routes:</h2>
    <ul>
      <li><a href="/home">/home - Layout & Blocks</a></li>
      <li><a href="/items">/items - Include Example</a></li>
      <li><a href="/macro">/macro - Macro Demo</a></li>
      <li><a href="/error-include">/error-include - Error in Included Template</a></li>
      <li><a href="/error-extend">/error-extend - Error in Extended Template</a></li>
      <li><a href="/precompile">/precompile - SQLite Precompiled</a></li>
    </ul>
  `);
});

app.get('/home', async (req, res) => {
  const html = await env.render('home.html', {
    username: 'John Doe',
    items: ['Apple', 'Banana', 'Cherry']
  });
  res.send(html);
});

app.get('/items', async (req, res) => {
  const html = await env.render('items.html', {
    items: [
      { name: 'Item 1', desc: 'Description 1' },
      { name: 'Item 2', desc: 'Description 2' },
      { name: 'Item 3', desc: 'Description 3' }
    ]
  });
  res.send(html);
});

app.get('/macro', async (req, res) => {
  const html = await env.render('macro-demo.html', {
    username: 'Macro User'
  });
  res.send(html);
});

app.get('/error-include', async (req, res) => {
  try {
    const html = await env.render('error-include.html');
    res.send(html);
  } catch (e) {
    res.status(500).send(`
      <h1>Error Caught!</h1>
      <pre>${e.message}</pre>
      <h3>Stack Trace:</h3>
      <pre>${e.stack}</pre>
    `);
  }
});

app.get('/error-extend', async (req, res) => {
  try {
    const html = await env.render('error-child.html');
    res.send(html);
  } catch (e) {
    res.status(500).send(`
      <h1>Error Caught!</h1>
      <pre>${e.message}</pre>
      <h3>Stack Trace:</h3>
      <pre>${e.stack}</pre>
    `);
  }
});

app.get('/precompile', async (req, res) => {
  res.send(`
    <h1>SQLite Precompile</h1>
    <p>Run this to precompile templates to SQLite:</p>
    <pre>bun ./nunjucks/src/bun-sqlite-precompile.js ./samples/express/views ./samples/express/views/templates.db</pre>
    <p>Then check the database for metadata:</p>
    <pre>bun --eval 'const db = new (require("bun:sqlite").Database)("./samples/express/views/templates.db"); console.log(db.query("SELECT * FROM _template_meta").all());'</pre>
  `);
});

app.listen(4000, () => {
  console.log('Demo server running on http://localhost:4000');
  console.log('Try these routes:');
  console.log('  /home         - Layout & Blocks');
  console.log('  /items        - Include Example');
  console.log('  /macro        - Macro Demo');
  console.log('  /error-include - Error in Included Template');
  console.log('  /error-extend  - Error in Extended Template');
  console.log('  /precompile   - SQLite Precompile Info');
});

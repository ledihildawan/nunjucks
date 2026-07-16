import path from 'path';
import { fileURLToPath } from 'url';
import { createEngine } from '../../src/index.js';
import nunjucks from '../../src/index.js';
import express from 'express';

import { errorRouter, errorRoutes } from './routes/errors.js';
import { sandboxRouter } from './routes/sandbox.js';
import { undefinedRouter } from './routes/undefined.js';
import { remoteRouter } from './routes/remote.js';
import { demoRouter } from './routes/demo.js';

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

app.use('/demo', demoRouter);

app.get('/file-error', (req, res, next) => {
  res.render('test_error', {});
});

app.use((err, req, res, next) => {
  console.log(err)
  console.log('\n' + err.output({ format: 'ansi' }) + '\n');
  res.status(500).type('html').send(err.output());
});

app.get('/', async (req, res) => {
  const html = await nunjucks.render('index.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

app.get('/home', async (req, res) => {
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

app.get('/info', (req, res) => {
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
  console.log('Run: node --watch samples/express/main.js');
});

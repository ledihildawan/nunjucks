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

app.get('/', async (req, res) => {
  const html = await env.render('index.html', {
    username: 'James Long <strong>copyright</strong>'
  });
  res.send(html);
});

app.get('/about', async (req, res) => {
  const html = await env.render('about.html');
  res.send(html);
});

app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});

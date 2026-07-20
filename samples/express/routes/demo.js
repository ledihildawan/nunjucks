import express from 'express';
import nunjucks from '../../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router = express.Router();

router.get('/try-catch', async (req, res) => {
  const html = await nunjucks.render('demo-try-catch.njk', {
    arr: [],
    name: { append: function(x) { return this.value + x; }, value: "Hello" },
    items: []
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/with', async (req, res) => {
  const html = await nunjucks.render('demo-with.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/do', async (req, res) => {
  const html = await nunjucks.render('demo-do.njk', {
    arr: [],
    name: { append: function(x) { return this.value + x; }, value: "Hello" },
    items: []
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/switch', async (req, res) => {
  const html = await nunjucks.render('demo-switch.njk', {
    status: "active",
    priority: 2
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/call', async (req, res) => {
  const html = await nunjucks.render('demo-call.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/pipe', async (req, res) => {
  const html = await nunjucks.render('demo-pipe.njk', {
    items: ["one", "two", "three"]
  }, { views: VIEWS });
  res.type('html').send(html);
});

export { router as demoRouter };

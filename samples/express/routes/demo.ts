import express, { type Router, type Request, type Response } from 'express';
import { render } from '@nunjucks/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

router.get('/try-catch', async (req: Request, res: Response) => {
  const html = await render('demo-try-catch.njk', {
    arr: [],
    name: { append: function(this: { value: string }, x: string) { return this.value + x; }, value: "Hello" },
    items: []
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/with', async (req: Request, res: Response) => {
  const html = await render('demo-with.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/do', async (req: Request, res: Response) => {
  const html = await render('demo-do.njk', {
    arr: [],
    name: { append: function(this: { value: string }, x: string) { return this.value + x; }, value: "Hello" },
    items: []
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/switch', async (req: Request, res: Response) => {
  const html = await render('demo-switch.njk', {
    status: "active",
    priority: 2
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/call', async (req: Request, res: Response) => {
  const html = await render('demo-call.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/pipe', async (req: Request, res: Response) => {
  const html = await render('demo-pipe.njk', {
    items: ["one", "two", "three"]
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/security', async (req: Request, res: Response) => {
  const html = await render('demo-security.njk', {
    userInput: '<script>alert("XSS attack!")</script><p>Hello World</p>',
    dangerousHtml: '<img src=x onerror="alert(1)"><script>document.location="http://evil.com"</script>',
    configData: { theme: 'dark', debug: true, count: 42 },
    userData: { name: 'John', role: 'admin', id: 123 },
    htmlContent: '<b>Bold</b> & "quoted"',
    attrContent: 'value="with quotes"\'s and stuff'
  }, { views: VIEWS, autoescape: true });
  res.type('html').send(html);
});

export { router as demoRouter };
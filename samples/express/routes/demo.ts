import express, { type Router, type Request, type Response } from 'express';
import { render } from '@nunjucks/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

router.get('/scope', async (_req: Request, res: Response) => {
  const html = await render('demo-scope.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/exec', async (_req: Request, res: Response) => {
  const html = await render('demo-exec.njk', {
    arr: [],
    name: { append: function(this: { value: string }, suffix: string) { return this.value + suffix; }, value: "Hello" },
    items: []
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/switch', async (_req: Request, res: Response) => {
  const html = await render('demo-switch.njk', {
    status: "active",
    priority: 2
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/slot', async (_req: Request, res: Response) => {
  const html = await render('demo-slot.njk', {}, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/component', async (_req: Request, res: Response) => {
  const html = await render('component-demo.njk', { username: 'John Doe' }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/pipe', async (_req: Request, res: Response) => {
  const html = await render('demo-pipe.njk', {
    items: ["one", "two", "three"]
  }, { views: VIEWS });
  res.type('html').send(html);
});

router.get('/security', async (_req: Request, res: Response) => {
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
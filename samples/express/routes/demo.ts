import express, { type Router, type Request, type Response } from 'express';
import { renderTemplate } from '../lib/express-render.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

router.get('/scope', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-scope.njk', { context: {}, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/exec', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-exec.njk', {
    context: {
      arr: [],
      name: { append: function(this: { value: string }, suffix: string) { return this.value + suffix; }, value: "Hello" },
      items: []
    }, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/switch', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-switch.njk', {
    context: {
      status: "active",
      priority: 2
    }, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/slot', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-slot.njk', { context: {}, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/component', async (_req: Request, res: Response) => {
  const html = await renderTemplate('component-demo.njk', { context: { username: 'John Doe' }, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/pipe', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-pipe.njk', {
    context: {
      items: ["one", "two", "three"]
    }, config: { views: VIEWS } });
  res.type('html').send(html);
});

router.get('/security', async (_req: Request, res: Response) => {
  const html = await renderTemplate('demo-security.njk', {
    context: {
      userInput: '<script>alert("XSS attack!")</script><p>Hello World</p>',
      dangerousHtml: '<img src=x onerror="alert(1)"><script>document.location="http://evil.com"</script>',
      configData: { theme: 'dark', debug: true, count: 42 },
      userData: { name: 'John', role: 'admin', id: 123 },
      htmlContent: '<b>Bold</b> & "quoted"',
      attrContent: 'value="with quotes"\'s and stuff'
    }, config: { views: VIEWS, autoescape: true } });
  res.type('html').send(html);
});

export { router as demoRouter };
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { VIEWS } from '../lib/io/views-path.ts';

const router: Router = express.Router();

router.get('/scope', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-scope.njk', { context: {}, config: { views: VIEWS } }),
  });
});

router.get('/exec', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-exec.njk', {
      context: {
        arr: [],
        name: {
          append: function (this: { value: string }, suffix: string) {
            return this.value + suffix;
          },
          value: 'Hello',
        },
        items: [],
      },
      config: { views: VIEWS },
    }),
  });
});

router.get('/switch', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-switch.njk', {
      context: {
        status: 'active',
        priority: 2,
      },
      config: { views: VIEWS },
    }),
  });
});

router.get('/slot', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-slot.njk', { context: {}, config: { views: VIEWS } }),
  });
});

router.get('/component', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('component-demo.njk', {
      context: { username: 'John Doe' },
      config: { views: VIEWS },
    }),
  });
});

router.get('/pipe', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-pipe.njk', {
      context: {
        items: ['one', 'two', 'three'],
      },
      config: { views: VIEWS },
    }),
  });
});

router.get('/security', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('demo-security.njk', {
      context: {
        userInput: '<script>alert("XSS attack!")</script><p>Hello World</p>',
        dangerousHtml:
          '<img src=x onerror="alert(1)"><script>document.location="http://evil.com"</script>',
        configData: { theme: 'dark', debug: true, count: 42 },
        userData: { name: 'John', role: 'admin', id: 123 },
        htmlContent: '<b>Bold</b> & "quoted"',
        attrContent: 'value="with quotes"\'s and stuff',
      },
      config: { views: VIEWS, autoescape: true },
    }),
  });
});

export { router as demoRouter };

import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { localizedTime } from '../lib/io/clock.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { standardRouteConfig } from '../lib/io/views-path.ts';

const router: Router = express.Router();

// WHY: engine-rendered shell (standardRouteConfig supplies views) + client-side fetch —
// the engine has no {% remote %} tag, so async composition is demonstrated honestly:
// the template owns the layout, the browser owns fragment loading with loading/error branches.
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('remote.njk', {
      context: {},
      config: standardRouteConfig,
    }),
  });
});

router.get('/api/hello', (_req: Request, res: Response) => {
  res.type('html').send('<strong>Hello from remote API!</strong>');
});

router.get('/api/time', (_req: Request, res: Response) => {
  res.type('html').send(`Current time: <strong>${localizedTime()}</strong>`);
});

router.get('/api/slow', (req: Request, res: Response) => {
  setTimeout(() => {
    if (req.destroyed) {
      return;
    }
    res.type('html').send('<strong>Slow content loaded!</strong>');
  }, 2000);
});

router.get('/api/error', (_req: Request, res: Response) => {
  res.status(500).send('Server error');
});

export { router as remoteRouter };

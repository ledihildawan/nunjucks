import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { VIEWS } from '../lib/io/views-path.ts';

const router: Router = express.Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('warnings.njk', {
    context: {
      pageTitle: 'Warnings Demo',
      availableValue: 'This value is defined',
      user: undefined,
    },
    config: {
      views: VIEWS,
      dev: true,
      undefined: 'debug',
      autoescape: true,
    },
  }));
});

export { router as warningsRouter };

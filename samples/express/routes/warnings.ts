import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, sendTemplateResult } from '../lib/express-render.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

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
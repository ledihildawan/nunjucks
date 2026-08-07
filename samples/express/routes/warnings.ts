import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@nunjucks/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const html = await render('warnings.njk', {
      pageTitle: 'Warnings Demo',
      availableValue: 'This value is defined',
      user: undefined,
    }, {
      views: VIEWS,
      dev: true,
      undefined: 'debug',
      autoescape: true,
    });
    res.type('html').send(html);
  } catch (error) {
    next(error);
  }
});

export { router as warningsRouter };
import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const html = await nunjucks.render('warnings.njk', {
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
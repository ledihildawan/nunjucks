import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, '..', 'views');
const router = express.Router();

router.get('/', async (req, res, next) => {
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

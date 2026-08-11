import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { renderTemplate } from '../lib/render-template.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

const querySchema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int().positive(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.issues });
    return;
  }

  try {
    const html = await renderTemplate('boundary.njk', {
      context: {
        name: parsed.data.name,
        count: parsed.data.count,
      }, config: { views: VIEWS, autoescape: true, dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

export { router as boundaryRouter };

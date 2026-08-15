import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { VIEWS } from '../lib/io/views-path.ts';

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

  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('boundary.njk', {
      context: {
        name: parsed.data.name,
        count: parsed.data.count,
      },
      config: { views: VIEWS, autoescape: true, dev: true },
    }),
  });
});

export { router as boundaryRouter };

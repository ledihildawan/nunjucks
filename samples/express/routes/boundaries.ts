import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { readValidatedQuery } from '../lib/io/validated-query.ts';
import { standardRouteConfig } from '../lib/io/views-path.ts';

/**
 * Boundary demo router — zod validates the `?name`/`?count` query before the engine
 * sees it (400 JSON on failure), then adapts the render `Result` into the response.
 */
const router: Router = express.Router();

// WHY: upper bounds model production hygiene — `name` flows into the render context
// and `count` into markup, so unbounded query strings must not ride past the edge.
const querySchema = z.object({
  name: z.string().min(1).max(200),
  count: z.coerce.number().int().positive().max(1_000_000),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const query = readValidatedQuery({ schema: querySchema, req, res });
  if (query === null) {
    return;
  }

  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('boundary.njk', {
      context: {
        name: query.name,
        count: query.count,
      },
      config: standardRouteConfig,
    }),
  });
});

export { router as boundaryRouter };

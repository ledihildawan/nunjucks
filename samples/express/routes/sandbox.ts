import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { createSandboxSuites, runTests } from '../lib/domain/sandbox-demo.ts';
import { renderTable } from '../lib/io/sandbox-table.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { devErrorRouteConfig, VIEWS } from '../lib/io/views-path.ts';

// WHY: the shell route owns the Node boundary — it supplies the real process reference for
// the sandbox scanner probes so lib/domain stays environment-neutral (mirrors routes/errors.ts).
const sandboxSuites = createSandboxSuites({ process });

/**
 * Sandbox demo router — static index page plus one route per suite built by
 * `createSandboxSuites`, running the probes and rendering each results table.
 */
const router: Router = express.Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('sandbox-index.njk', {
      context: {},
      config: { ...devErrorRouteConfig, views: VIEWS },
    }),
  });
});

// WHY: imperative loop for route registration — each suite registers a GET handler under its
// own key. Loop exemption: static suite list (no dynamic fan-out); no GC pressure.
for (const suite of sandboxSuites) {
  router.get(`/${suite.key}`, async (_req: Request, res: Response) => {
    const table = await runTests({
      tests: suite.tests,
      context: suite.context,
      config: suite.config,
    });
    res.type('html').send(renderTable(table, suite));
  });
}

export { router as sandboxRouter };

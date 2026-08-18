import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { dashboardData } from '../lib/domain/dashboard-data.ts';
import { isoTimestamp } from '../lib/io/clock.ts';
import { apiNjk, blockingNjk, streamNjk } from '../lib/io/stream-engines.ts';
import { streamTemplateToResponse } from '../lib/io/stream-wiring.ts';

/**
 * Streaming demo router — progressive HTML streaming with recovery, a blocking
 * benchmark twin, a JSON API variant, and a fatal block-error demo, all piped
 * through shared guardrails.
 */
const router: Router = express.Router();

const dashboardContext = (mode: string): Record<string, unknown> => ({
  ...dashboardData,
  mode,
  timestamp: isoTimestamp(),
});

// WHY: streaming route — uses {% extends %} + {% block %} template files. Error recovery + strict mode means missing data (order #2 city, customer bio) produces inline markers. Demonstrates the full production guardrail chain: client-disconnect signal (cascade cleanup), idle per-chunk timeout (timeoutMs), total deadline (executionTimeout), output-size breaker (maxOutputSize), and per-phase error observability (onError). onComplete logs chunk count, error count, total KB.
router.get('/stream', async (req: Request, res: Response, next: NextFunction) => {
  await streamTemplateToResponse({
    engine: streamNjk,
    template: 'stream-dashboard.njk',
    context: dashboardContext('Streaming'),
    req,
    res,
    next,
    label: 'stream',
  });
});

// WHY: benchmark comparison — same template + data + config, but blocking render. Both routes succeed (non-strict for normal) so the comparison is purely about SPEED: /stream shows progressive block-by-block render; /stream-normal buffers everything, user waits for the full render before seeing anything. The `req.destroyed` guard skips sending a buffered response to a client that disconnected during the (potentially long) blocking render — the render itself cannot be aborted mid-flight (no signal on the blocking API), but executionTimeout bounds its total time. Errors delegate to the central error middleware (app.ts) so this route shares the same source-file diagnostics + PII-redacted logging as every other route instead of a drifting inline formatter.
router.get('/stream-normal', async (req: Request, res: Response, next: NextFunction) => {
  const result = await blockingNjk.render('stream-dashboard.njk', dashboardContext('Blocking'));
  if (req.destroyed) {
    return;
  }
  if (result.ok) {
    return res.type('html').send(result.value);
  }
  return next(result.error);
});

// WHY: JSON streaming API — same dashboard data but rendered as JSON. Walrus operator computes derived field inline. NOTE: JSON cannot absorb inline error markers without corrupting the response (a bare {error:...} fragment after a JSON prefix is unparseable), so streamContentType: 'json' makes any mid-stream recoverable sentinel FATAL — the stream aborts to the Tier 3 mid-stream path (onError fires, response ends) rather than emitting a marker. Use html/text if you want per-expression inline recovery.
router.get('/stream-api', async (req: Request, res: Response, next: NextFunction) => {
  await streamTemplateToResponse({
    engine: apiNjk,
    template:
      '{{ avgOrder := kpi.revenueNum / kpi.orderCount }}{{ { revenue: kpi.revenue, avgOrder: avgOrder, orders: orders, customer: customer } |> tojson }}',
    context: dashboardContext('JSON API'),
    req,
    res,
    next,
    label: 'stream-api',
  });
});

// WHY: block-level error UI demo — /stream shows inline markers (compact icons) for recoverable
// expression errors (missing variables). This route triggers a FATAL include error (FILE_NOT_FOUND)
// which renders as a full BLOCK error card (not just an inline icon). The error occupies the
// full widget area, providing much more visible feedback than an inline marker.
router.get('/stream-block-error', async (req: Request, res: Response, next: NextFunction) => {
  await streamTemplateToResponse({
    engine: streamNjk,
    template: 'stream-block-error-demo.njk',
    context: dashboardContext('Block Error Demo'),
    req,
    res,
    next,
    label: 'stream-block-error',
  });
});

export { router as streamingRouter };

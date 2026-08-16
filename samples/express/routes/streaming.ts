import { formatError } from '@nunjucks/core';
import { PACKAGE_VERSION } from '@nunjucks/integrations/express';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { dashboardData } from '../lib/domain/dashboard-data.ts';
import { isoTimestamp } from '../lib/io/clock.ts';
import { apiNjk, blockingNjk, streamNjk } from '../lib/io/stream-engines.ts';

const router: Router = express.Router();

// WHY: shared pipeRenderStream guardrails — every streaming route gets the same per-chunk
// idle timeout and output-size breaker so no route can stream unbounded output.
const streamIdleTimeoutMs = 10000;
const streamMaxOutputBytes = 2 * 1024 * 1024;

const dashboardContext = (mode: string): Record<string, unknown> => ({
  ...dashboardData,
  mode,
  timestamp: isoTimestamp(),
});

// WHY: wires an Express client-disconnect to an AbortSignal so pipeRenderStream can abort the render and cascade-cleanup the moment the browser closes the connection. The `!res.writableEnded` guard avoids a spurious abort after the response has already completed normally. The listener lives for the request lifecycle (GC'd with req) — no leak.
const createDisconnectSignal = (req: Request, res: Response): AbortSignal => {
  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  return controller.signal;
};

// WHY: streaming route — uses {% extends %} + {% block %} template files. Error recovery + strict mode means missing data (order #2 city, customer bio) produces inline markers. Demonstrates the full production guardrail chain: client-disconnect signal (cascade cleanup), idle per-chunk timeout (timeoutMs), total deadline (executionTimeout), output-size breaker (maxOutputSize), and per-phase error observability (onError). onComplete logs chunk count, error count, total KB.
router.get('/stream', async (req: Request, res: Response, next: NextFunction) => {
  const streamResult = await streamNjk.renderToStream(
    'stream-dashboard.njk',
    dashboardContext('Streaming')
  );
  if (!streamResult.ok) {
    return next(streamResult.error);
  }
  await streamNjk.pipeRenderStream(streamResult, res, {
    signal: createDisconnectSignal(req, res),
    timeoutMs: streamIdleTimeoutMs,
    maxOutputSize: streamMaxOutputBytes,
    onError: (err, phase) => {
      console.error(`[stream] ${phase} error: ${err.message}`);
    },
    onComplete: (stats) => {
      console.log(
        `[stream] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`
      );
    },
  });
});

// WHY: benchmark comparison — same template + data + config, but blocking render. Both routes succeed (non-strict for normal) so the comparison is purely about SPEED: /stream shows progressive block-by-block render; /stream-normal buffers everything, user waits for the full render before seeing anything. The `req.destroyed` guard skips sending a buffered response to a client that disconnected during the (potentially long) blocking render — the render itself cannot be aborted mid-flight (no signal on the blocking API), but executionTimeout bounds its total time.
router.get('/stream-normal', async (req: Request, res: Response) => {
  const result = await blockingNjk.render('stream-dashboard.njk', dashboardContext('Blocking'));
  if (req.destroyed) {
    return;
  }
  if (result.ok) {
    res.type('html').send(result.value);
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.error(formatError(result.error, { format: 'ansi' }));
    }
    res.status(500).type('html').send(
      formatError(result.error, {
        format: 'html',
        dev: process.env.NODE_ENV !== 'production',
        version: PACKAGE_VERSION,
      })
    );
  }
});

// WHY: JSON streaming API — same dashboard data but rendered as JSON. Walrus operator computes derived field inline. NOTE: JSON cannot absorb inline error markers without corrupting the response (a bare {error:...} fragment after a JSON prefix is unparseable), so streamContentType: 'json' makes any mid-stream recoverable sentinel FATAL — the stream aborts to the Tier 3 mid-stream path (onError fires, response ends) rather than emitting a marker. Use html/text if you want per-expression inline recovery.
router.get('/stream-api', async (req: Request, res: Response, next: NextFunction) => {
  const streamResult = await apiNjk.renderToStream(
    '{{ avgOrder := kpi.revenueNum / kpi.orderCount }}{{ { revenue: kpi.revenue, avgOrder: avgOrder, orders: orders, customer: customer } |> tojson }}',
    dashboardContext('JSON API')
  );
  if (!streamResult.ok) {
    return next(streamResult.error);
  }
  await apiNjk.pipeRenderStream(streamResult, res, {
    signal: createDisconnectSignal(req, res),
    timeoutMs: streamIdleTimeoutMs,
    maxOutputSize: streamMaxOutputBytes,
    onError: (err, phase) => {
      console.error(`[stream-api] ${phase} error: ${err.message}`);
    },
    onComplete: (stats) => {
      console.log(
        `[stream-api] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`
      );
    },
  });
});

// WHY: block-level error UI demo — /stream shows inline markers (compact icons) for recoverable
// expression errors (missing variables). This route triggers a FATAL include error (FILE_NOT_FOUND)
// which renders as a full BLOCK error card (not just an inline icon). The error occupies the
// full widget area, providing much more visible feedback than an inline marker.
router.get('/stream-block-error', async (req: Request, res: Response, next: NextFunction) => {
  const streamResult = await streamNjk.renderToStream(
    'stream-block-error-demo.njk',
    dashboardContext('Block Error Demo')
  );
  if (!streamResult.ok) {
    return next(streamResult.error);
  }
  await streamNjk.pipeRenderStream(streamResult, res, {
    signal: createDisconnectSignal(req, res),
    timeoutMs: streamIdleTimeoutMs,
    maxOutputSize: streamMaxOutputBytes,
    onError: (err, phase) => {
      console.error(`[stream-block-error] ${phase} error: ${err.message}`);
    },
    onComplete: (stats) => {
      console.log(
        `[stream-block-error] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`
      );
    },
  });
});

export { router as streamingRouter };

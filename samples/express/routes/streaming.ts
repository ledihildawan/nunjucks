import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Router, type Request, type Response } from 'express';
import { nunjucks } from '@nunjucks/core';
import { formatError } from '@nunjucks/error-formatter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router: Router = express.Router();

// WHY: streaming demo — a realistic e-commerce admin dashboard using {% extends %} + {% block %} template inheritance. Each block has async content (|> slow filter simulating DB latency) to demonstrate progressive block-by-block streaming. streamErrorRecovery + undefined: 'strict' means incomplete data (missing shipping city on order #2, customer without bio, walrus division by missing field) yields inline error markers via 8 boundary types — the rest of the dashboard renders normally. Walrus operator (:=) computes avg order value in KPIs block.
const slow = async (value: unknown): Promise<string> => {
  await new Promise((resolve) => { setTimeout(resolve, 350); });
  return String(value);
};
const formatPrice = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
};

const dashboardData = {
  mode: 'Streaming',
  kpi: { revenue: '$125,430', revenueNum: 125430, orderCount: 342, orders: '342', conversion: '3.2' },
  orders: [
    { id: 'ORD-7841', customer: 'Alice Chen', total: 89.99, shipping: { city: 'Jakarta' }, status: 'shipped' },
    { id: 'ORD-7842', customer: 'Bob Smith', total: 245.00, shipping: {}, status: 'processing' },
    { id: 'ORD-7843', customer: 'Charlie Doe', total: 12.50, shipping: { city: 'Bandung' }, status: 'pending' },
  ],
  products: [
    { name: 'Wireless Headphones', price: 79.99, stock: 23 },
    { name: 'USB-C Hub 8-in-1', price: 34.50, stock: 0 },
    { name: 'Mechanical Keyboard', price: 129.00, stock: 7 },
  ],
  customer: { name: 'Ada Lovelace', joinedAt: 'Jan 2024' },
  timestamp: new Date().toISOString(),
};

// WHY: one factory per distinct config profile. /stream + /stream-api share strict-undefined + recovery;
// /stream-normal is a non-strict blocking benchmark; /stream-api adds the JSON content type (fatal sentinels).
// Configuring once at module load avoids rebuilding the engine per request.
const streamNjk = nunjucks({
  dev: true,
  undefined: 'strict',
  views: VIEWS,
  filters: { slow, formatPrice },
  limits: { executionTimeout: 30000 },
  streaming: { errorRecovery: true },
});

const blockingNjk = nunjucks({
  dev: true,
  undefined: 'default',
  views: VIEWS,
  filters: { slow, formatPrice },
  limits: { executionTimeout: 30000 },
});

const apiNjk = nunjucks({
  dev: true,
  undefined: 'strict',
  views: VIEWS,
  filters: { slow, formatPrice },
  limits: { executionTimeout: 30000 },
  streaming: { errorRecovery: true, contentType: 'json' },
});

// WHY: wires an Express client-disconnect to an AbortSignal so pipeRenderStream can abort the render and cascade-cleanup the moment the browser closes the connection. The `!res.writableEnded` guard avoids a spurious abort after the response has already completed normally. The listener lives for the request lifecycle (GC'd with req) — no leak.
const createDisconnectSignal = (req: Request, res: Response): AbortSignal => {
  const controller = new AbortController();
  req.on('close', () => { if (!res.writableEnded) { controller.abort(); } });
  return controller.signal;
};

// WHY: streaming route — uses {% extends %} + {% block %} template files. Error recovery + strict mode means missing data (order #2 city, customer bio) produces inline markers. Demonstrates the full production guardrail chain: client-disconnect signal (cascade cleanup), idle per-chunk timeout (timeoutMs), total deadline (executionTimeout), output-size breaker (maxOutputSize), and per-phase error observability (onError). onComplete logs chunk count, error count, total KB.
router.get('/stream', async (req: Request, res: Response) => {
  await streamNjk.pipeRenderStream(
    await streamNjk.renderToStream('stream-dashboard.njk', { ...dashboardData, mode: 'Streaming' }),
    res,
    {
      signal: createDisconnectSignal(req, res),
      timeoutMs: 10000,
      maxOutputSize: 2 * 1024 * 1024,
      onError: (err, phase) => {
        console.log(`[stream] ${phase} error: ${err.message}`);
      },
      onComplete: (stats) => {
        console.log(`[stream] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`);
      },
    }
  );
});

// WHY: benchmark comparison — same template + data + config, but blocking render. Both routes succeed (non-strict for normal) so the comparison is purely about SPEED: /stream shows progressive block-by-block render; /stream-normal buffers everything, user waits for the full render before seeing anything. The `req.destroyed` guard skips sending a buffered response to a client that disconnected during the (potentially long) blocking render — the render itself cannot be aborted mid-flight (no signal on the blocking API), but executionTimeout bounds its total time.
router.get('/stream-normal', async (req: Request, res: Response) => {
  const result = await blockingNjk.render('stream-dashboard.njk', { ...dashboardData, mode: 'Blocking' });
  if (req.destroyed) { return; }
  if (result.ok) {
    res.type('html').send(result.value);
  } else {
    res.status(500).type('html').send(formatError(result.error, { format: 'html', dev: true }));
  }
});

// WHY: JSON streaming API — same dashboard data but rendered as JSON. Walrus operator computes derived field inline. NOTE: JSON cannot absorb inline error markers without corrupting the response (a bare {error:...} fragment after a JSON prefix is unparseable), so streamContentType: 'json' makes any mid-stream recoverable sentinel FATAL — the stream aborts to the Tier 3 mid-stream path (onError fires, response ends) rather than emitting a marker. Use html/text if you want per-expression inline recovery.
router.get('/stream-api', async (req: Request, res: Response) => {
  await apiNjk.pipeRenderStream(
    await apiNjk.renderToStream('{{ avgOrder := kpi.revenueNum / kpi.orderCount }}{{ { revenue: kpi.revenue, avgOrder: avgOrder, orders: orders, customer: customer } |> tojson }}', { ...dashboardData, mode: 'JSON API' }),
    res,
    {
      signal: createDisconnectSignal(req, res),
      onError: (err, phase) => {
        console.log(`[stream-api] ${phase} error: ${err.message}`);
      },
      onComplete: (stats) => {
        console.log(`[stream-api] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`);
      },
    }
  );
});

export { router as streamingRouter };

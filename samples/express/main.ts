import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createEngine, type ExpressEngineConfig } from '@nunjucks/integrations/express';
import { renderTemplate } from './lib/render-template.ts';
import { renderToStream, pipeRenderStream, render } from '@nunjucks/core';
import { formatError } from '@nunjucks/log';import { demoRouter } from './routes/demo.ts';
import { errorRouter } from './routes/errors.ts';
import { boundaryRouter } from './routes/boundaries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const app: Express = express();

const engineConfig: ExpressEngineConfig = {
  dev: true,
  autoescape: true,
  globals: {
    appName: 'Nunjucks Express Demo',
    version: '1.0.0',
    getYear: () => new Date().getFullYear(),
  },
  filters: {
    shout: (v: string) => `${String(v).toUpperCase()}!!!`,
  },
};

app.set('views', VIEWS);
app.engine('.njk', createEngine(engineConfig));
app.set('view engine', 'njk');

app.get('/', (_req: Request, res: Response) => {
  res.render('index', { userName: 'Guest' });
});

app.get('/home', async (_req: Request, res: Response) => {
  const html = await renderTemplate(
    `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <h1>Welcome, {{ username }}!</h1>
  <p>App: {{ appName }} v{{ version }}</p>
  <p>Year: {{ getYear() }}</p>
  <p>Shout: {{ "hello" |> shout }}</p>
</body>
</html>`,
    { username: 'John Doe' },
    engineConfig
  );
  res.type('html').send(html);
});

app.get('/security', async (_req: Request, res: Response) => {
  const html = await renderTemplate(
    `<!DOCTYPE html>
<html>
<head><title>Security Features Demo</title></head>
<body>
  <h1>Security Features Demo</h1>

  <h2>1. Sanitize Filter (DOMPurify)</h2>
  <p>Raw user input (XSS risk): <code>{{ userInput }}</code></p>
  <p>Sanitized: <code>{{ userInput |> sanitize }}</code></p>

  <h2>2. Auto-toJSON in Script Context</h2>
  <script>
    const config = {{ configData }};
    console.log('Config loaded:', config);
  </script>

  <h2>3. Context-Aware Escaping</h2>
  <p>HTML: <code>{{ htmlContent }}</code></p>
  <p>Attribute: <code>&lt;div data-value="{{ attrContent }}"&gt;&lt;/div&gt;</code></p>
</body>
</html>`,
    {
      userInput: '<script>alert("XSS")</script><p>Safe content</p>',
      configData: { theme: 'dark', debug: true },
      htmlContent: '<b>Bold</b> & "quoted"',
      attrContent: 'value="with quotes"'
    },
    engineConfig
  );
  res.type('html').send(html);
});

app.use('/demo', demoRouter);
app.use('/errors', errorRouter);
app.use('/boundary', boundaryRouter);

// WHY: streaming demo — a realistic e-commerce admin dashboard. Each section fetches data from a "slow" async source (simulating DB/API latency), so the browser renders progressively: header + KPIs arrive first, then orders stream in one-by-one, then products. streamErrorRecovery ensures that incomplete data (missing shipping city on order #2, an undeployed weather-widget template) yields an inline error marker instead of killing the entire dashboard.
const slow = async (value: unknown): Promise<string> => {
  await new Promise((resolve) => { setTimeout(resolve, 350); });
  return String(value);
};
const formatPrice = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
};

const streamTemplate = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Admin Dashboard</title>
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.5}
  .container{max-width:56rem;margin:0 auto;padding:1.5rem}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
  header h1{font-size:1.5rem;font-weight:700}
  header time{font-size:.8rem;color:#64748b}
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:2rem}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:.625rem;padding:1.25rem}
  .kpi .label{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  .kpi .value{font-size:1.75rem;font-weight:700;margin-top:.25rem}
  .kpi .trend{font-size:.75rem;margin-top:.25rem}
  .trend-up{color:#059669}.trend-down{color:#dc2626}
  section{margin-bottom:2rem}
  section h2{font-size:1.125rem;font-weight:600;margin-bottom:.75rem}
  .order-row{display:grid;grid-template-columns:1fr 1fr auto auto auto;gap:.75rem;align-items:center;background:#fff;border:1px solid #e2e8f0;border-top:none;padding:.625rem .875rem;font-size:.875rem}
  .order-row:first-of-type{border-top:1px solid #e2e8f0;border-top-left-radius:.625rem;border-top-right-radius:.625rem}
  .order-row:last-of-type{border-bottom-left-radius:.625rem;border-bottom-right-radius:.625rem}
  .order-head{display:grid;grid-template-columns:1fr 1fr auto auto auto;gap:.75rem;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:.625rem .875rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.625rem .625rem 0 0}
  .badge{display:inline-block;padding:.125rem .5rem;border-radius:.25rem;font-size:.7rem;font-weight:600}
  .badge-shipped{background:#d1fae5;color:#065f46}
  .badge-pending{background:#fef3c7;color:#92400e}
  .badge-processing{background:#dbeafe;color:#1e40af}
  .product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
  .product-card{background:#fff;border:1px solid #e2e8f0;border-radius:.625rem;padding:1rem}
  .product-card h3{font-size:.875rem;font-weight:600;margin-bottom:.25rem}
  .product-card .price{font-size:1.125rem;font-weight:700;color:#059669}
  .product-card .stock{font-size:.75rem;color:#64748b;margin-top:.25rem}
  .stock-out{color:#dc2626;font-weight:600}
  .widget{background:#fff;border:1px solid #e2e8f0;border-radius:.625rem;padding:1.25rem;margin-bottom:2rem}
  footer{text-align:center;padding:2rem 0;font-size:.75rem;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:2rem}
</style>
</head><body>
<div class="container">
  <header>
    <h1>Store Dashboard</h1>
    <time>Live · streamed response</time>
  </header>

  <div class="kpi-grid">
    <div class="kpi"><div class="label">Revenue</div><div class="value">{{ kpi.revenue |> slow }}</div><div class="trend trend-up">+12.4% vs last week</div></div>
    <div class="kpi"><div class="label">Orders</div><div class="value">{{ kpi.orders |> slow }}</div><div class="trend trend-up">+8 today</div></div>
    <div class="kpi"><div class="label">Conversion</div><div class="value">{{ kpi.conversion |> slow }}%</div><div class="trend trend-down">-0.3% vs target</div></div>
  </div>

  <section>
    <h2>Recent Orders</h2>
    <div class="order-head"><span>Order</span><span>Customer</span><span>Total</span><span>Ship To</span><span>Status</span></div>
    {% for order in orders %}
    <div class="order-row">
      <span>{{ order.id |> slow }}</span>
      <span>{{ order.customer |> slow }}</span>
      <span>{{ order.total |> formatPrice }}</span>
      <span>{{ order.shipping.address.city }}</span>
      <span><span class="badge badge-{{ order.status }}">{{ order.status }}</span></span>
    </div>
    {% endfor %}
  </section>

  <section>
    <h2>Top Products</h2>
    <div class="product-grid">
      {% for product in products %}
      <div class="product-card">
        <h3>{{ product.name |> slow }}</h3>
        <div class="price">{{ product.price |> formatPrice }}</div>
        <div class="stock">{% if product.stock == 0 %}<span class="stock-out">Out of stock</span>{% else %}{{ product.stock }} in stock{% endif %}</div>
      </div>
      {% endfor %}
    </div>
  </section>

  <section>
    <h2>Customer Spotlight</h2>
    <div class="widget">
      <h3>{{ customer.name |> slow }}</h3>
      <p style="color:#64748b;font-size:.875rem;margin-top:.25rem">{{ customer.bio }}</p>
      <p style="font-size:.75rem;color:#94a3b8;margin-top:.5rem">Member since {{ customer.joinedAt |> slow }}</p>
    </div>
  </section>

  <div class="widget">
    {% include "weather-widget.njk" %}
  </div>

  <footer>Rendered via Nunjucks streaming · {{ timestamp }}</footer>
</div>
</body></html>`;

// WHY: realistic data shapes — orders[1] has incomplete shipping data (empty address object, missing city), customer lacks bio. These are natural data-merge gaps, not contrived errors. In strict mode they produce inline markers; the rest of the dashboard renders normally.
const streamContext = {
  context: {
    kpi: { revenue: '$125,430', orders: '342', conversion: '3.2' },
    orders: [
      { id: 'ORD-7841', customer: 'Alice Chen', total: 89.99, shipping: { address: { city: 'Jakarta' } }, status: 'shipped' },
      { id: 'ORD-7842', customer: 'Bob Smith', total: 245.00, shipping: { address: {} }, status: 'processing' },
      { id: 'ORD-7843', customer: 'Charlie Doe', total: 12.50, shipping: { address: { city: 'Bandung' } }, status: 'pending' },
    ],
    products: [
      { name: 'Wireless Headphones', price: 79.99, stock: 23 },
      { name: 'USB-C Hub 8-in-1', price: 34.50, stock: 0 },
      { name: 'Mechanical Keyboard', price: 129.00, stock: 7 },
    ],
    customer: { name: 'Ada Lovelace', joinedAt: 'Jan 2024' },
    timestamp: new Date().toISOString(),
  },
  dev: true,
  undefined: 'strict',
  streamErrorRecovery: true,
  views: VIEWS,
  filters: { slow, formatPrice },
};

// WHY: recommended approach — pipeRenderStream handles everything in one call: pre-stream error → full page, success → pipe chunks, mid-stream error → inline marker + overlay. This is the only streaming route you need.
app.get('/stream', async (_req: Request, res: Response) => {
  await pipeRenderStream(
    await renderToStream(streamTemplate, streamContext),
    res,
    { contentType: 'html', dev: true }
  );
});

// WHY: benchmark comparison — same template + data, but blocking render(). Both routes succeed so the comparison is purely about SPEED: /stream shows progressive render (content chunk-by-chunk); /stream-normal buffers everything, user waits for the full render before seeing anything. Open both in side-by-side tabs.
app.get('/stream-normal', async (_req: Request, res: Response) => {
  const result = await render(streamTemplate, { ...streamContext, streamErrorRecovery: false, undefined: 'default' });
  if (result.ok) {
    res.type('html').send(result.value);
  } else {
    res.status(500).type('html').send(formatError(result.error, { format: 'html', dev: true }));
  }
});

app.use(async (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.log(formatError(err, { format: 'ansi', dev: true }));
  res.status(500).type('html').send(formatError(err, { format: 'html', dev: true }));
});

app.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
  console.log('\nDemo routes:');
  console.log('  /              - Home');
  console.log('  /home          - Inline template with pipe syntax');
  console.log('  /security      - Security features (sanitize, auto-tojson)');
  console.log('  /stream        - Streaming dashboard (progressive render + error recovery)');
  console.log('  /stream-normal - Same dashboard, blocking render (compare side-by-side)');
  console.log('  /demo/*        - Demo routes (pipe, scope, switch, slot, component, etc)');
  console.log('  /errors        - Error scenarios index');
  console.log('  /errors/*      - Individual error scenarios');
  console.log('  /boundary      - Boundary validation (zod schema on req.query)');
});

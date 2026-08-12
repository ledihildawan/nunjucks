import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nunjucks } from '@nunjucks/core';
import { isoTimestamp } from './clock.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

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
  timestamp: isoTimestamp(),
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

export { dashboardData, streamNjk, blockingNjk, apiNjk };
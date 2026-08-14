import { isoTimestamp } from '../io/clock.ts';

// WHY: streaming demo — a realistic e-commerce admin dashboard using {% extends %} + {% block %} template inheritance. Each block has async content (|> slow filter simulating DB latency) to demonstrate progressive block-by-block streaming. streamErrorRecovery + undefined: 'strict' means incomplete data (missing shipping city on order #2, customer without bio, walrus division by missing field) yields inline error markers via 8 boundary types — the rest of the dashboard renders normally. Walrus operator (:=) computes avg order value in KPIs block.
const formatPrice = (value: unknown): string => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `$${numericValue.toFixed(2)}` : '—';
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
  weather: { location: 'Jakarta', tempC: 31, condition: 'Partly Cloudy', humidity: 72, windKph: 14 },
  timestamp: isoTimestamp(),
};

export { formatPrice, dashboardData };

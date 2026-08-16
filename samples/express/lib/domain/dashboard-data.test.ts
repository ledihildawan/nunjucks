import { describe, expect, test } from 'bun:test';
import { dashboardData, formatPrice } from './dashboard-data.ts';

describe('formatPrice', () => {
  test('formats finite numbers with two decimals and a dollar sign', () => {
    expect(formatPrice(89.99)).toBe('$89.99');
    expect(formatPrice(245)).toBe('$245.00');
    expect(formatPrice(12.5)).toBe('$12.50');
  });

  test('coerces numeric strings before formatting', () => {
    expect(formatPrice('79.99')).toBe('$79.99');
  });

  test('returns an em dash for non-finite values', () => {
    expect(formatPrice('not-a-number')).toBe('—');
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
  });
});

describe('dashboardData invariants', () => {
  test('order ids are unique', () => {
    const orderIds = dashboardData.orders.map((order) => order.id);
    expect(new Set(orderIds).size).toBe(orderIds.length);
  });

  test('every product price is a positive finite number', () => {
    expect(dashboardData.products.every((product) => Number.isFinite(product.price))).toBe(true);
    expect(dashboardData.products.every((product) => product.price > 0)).toBe(true);
  });

  test('every product price renders through formatPrice without a fallback dash', () => {
    expect(
      dashboardData.products.every((product) => formatPrice(product.price) !== '—')
    ).toBe(true);
  });
});

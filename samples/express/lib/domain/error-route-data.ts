import type { ErrorRoute } from './error-route-types.ts';

const complexUserContext: Record<string, unknown> = {
  user: {
    id: 'usr_8a9b2c3d4e5f',
    username: 'alice_dev',
    profile: {
      firstName: 'Alice',
      lastName: 'Johnson',
      avatar: 'https://example.com/avatars/alice.jpg',
      bio: 'Full-stack developer & open source enthusiast',
      settings: {
        theme: 'dark',
        notifications: true,
        language: 'en-US',
      },
    },
    metadata: {
      createdAt: '2024-01-15T08:30:00Z',
      lastLogin: '2026-07-09T14:22:00Z',
      permissions: ['read', 'write', 'admin'],
      tags: ['vip', 'beta-tester'],
    },
  },
  role: 'admin',
  cart: {
    items: [
      { id: 'item_001', name: 'Wireless Keyboard', price: 79.99, quantity: 1 },
      { id: 'item_002', name: 'USB-C Hub', price: 49.99, quantity: 2 },
    ],
    total: 179.97,
    currency: 'USD',
    couponCode: null,
  },
  preferences: {
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York',
  },
};

const errorRoutes: ErrorRoute[] = [
  {
    path: 'undefined-variable',
    template: 'errors/undefined-variable.njk',
    context: { user: complexUserContext.user },
  },
  {
    path: 'undefined-function',
    template: 'errors/undefined-function.njk',
    context: complexUserContext,
  },
  {
    path: 'not-a-function',
    template: 'errors/not-a-function.njk',
    context: { user: { name: 'Alice', status: 'active' } },
  },
  {
    path: 'undefined-filter',
    template: 'errors/undefined-filter.njk',
    context: complexUserContext,
  },
  {
    path: 'undefined-value',
    template: 'errors/undefined-value.njk',
    context: { product: null },
  },
  {
    path: 'syntax-error',
    template: 'errors/syntax-error.njk',
    context: {},
  },
  {
    path: 'parser-expected',
    template: 'errors/parser-expected.njk',
    context: {},
  },
  {
    path: 'invalid-lookup',
    template: 'errors/invalid-lookup.njk',
    context: {},
  },
  {
    path: 'duplicate-block',
    template: 'errors/duplicate-block.njk',
    context: {},
  },
  {
    path: 'unknown-block-tag',
    template: 'errors/unknown-block-tag.njk',
    context: {},
  },
  {
    path: 'sort-filter-attr',
    template: 'errors/sort-filter-attr.njk',
    context: { items: [{ name: 'test' }] },
  },
  {
    path: 'groupby-filter',
    template: 'errors/groupby-filter.njk',
    context: { items: 42 },
  },
  {
    path: 'groupby-filter-attr',
    template: 'errors/groupby-filter-attr.njk',
    context: { items: [{ name: 'test' }] },
  },
];

export { errorRoutes };

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
    category: 'undefined_variable',
    desc: 'Variable not in context',
  },
  {
    path: 'undefined-function',
    template: 'errors/undefined-function.njk',
    context: complexUserContext,
    category: 'undefined_function',
    desc: 'Function not registered',
  },
  {
    path: 'not-a-function',
    template: 'errors/not-a-function.njk',
    context: { user: { name: 'Alice', status: 'active' } },
    category: 'not_a_function',
    desc: 'Calling non-function value',
  },
  {
    path: 'undefined-filter',
    template: 'errors/undefined-filter.njk',
    context: complexUserContext,
    category: 'undefined_filter',
    desc: 'Filter not registered',
  },
  {
    path: 'filter-error',
    template: 'errors/filter-error.njk',
    context: { value: 42, data: complexUserContext },
    category: 'filter_error',
    desc: 'Filter throws during execution',
  },
  {
    path: 'undefined-value',
    template: 'errors/undefined-value.njk',
    context: { product: null },
    category: 'undefined_value',
    desc: 'Nested property is null',
  },
  {
    path: 'syntax-error',
    template: 'errors/syntax-error.njk',
    context: {},
    category: 'syntax_error',
    desc: 'Invalid template syntax',
  },
  {
    path: 'parser-expected',
    template: 'errors/parser-expected.njk',
    context: {},
    category: 'syntax_error',
    desc: 'Parser expected different token',
  },
  {
    path: 'invalid-lookup',
    template: 'errors/invalid-lookup.njk',
    context: {},
    category: 'invalid_lookup',
    desc: 'Invalid bracket notation',
  },
  {
    path: 'duplicate-block',
    template: 'errors/duplicate-block.njk',
    context: {},
    category: 'duplicate_block',
    desc: 'Duplicate block definition',
  },
  {
    path: 'unknown-block-tag',
    template: 'errors/unknown-block-tag.njk',
    context: {},
    category: 'unknown_block_tag',
    desc: 'Unmatched closing tag',
  },
  {
    path: 'sort-filter-attr',
    template: 'errors/sort-filter-attr.njk',
    context: { items: [{ name: 'test' }] },
    category: 'sort_filter_attr',
    desc: 'Sort attribute undefined',
  },
  {
    path: 'groupby-filter',
    template: 'errors/groupby-filter.njk',
    context: { items: 42 },
    category: 'groupby_filter',
    desc: 'Groupby filter type error',
  },
  {
    path: 'groupby-filter-attr',
    template: 'errors/groupby-filter-attr.njk',
    context: { items: [{ name: 'test' }] },
    category: 'groupby_filter_attr',
    desc: 'Groupby attribute undefined',
  },
  {
    path: 'dictsort-filter',
    template: 'errors/dictsort-filter.njk',
    context: { data: 'not an object' },
    category: 'dictsort_filter',
    desc: 'Dictsort requires object',
  },
  {
    path: 'dictsort-filter-by',
    template: 'errors/dictsort-filter-by.njk',
    context: { data: { a: 1, b: 2 } },
    category: 'dictsort_filter_by',
    desc: 'Dictsort invalid by param',
  },
];

export { errorRoutes };

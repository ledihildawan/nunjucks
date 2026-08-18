
const makeContext = () => {
  const userProfile = Object.freeze({
    firstName: 'Alice',
    lastName: 'Johnson',
    avatar: 'https://example.com/avatars/alice.jpg',
    bio: 'Full-stack developer & open source enthusiast',
    settings: Object.freeze({ theme: 'dark', notifications: true, language: 'en-US' }),
  });
  const userMeta = Object.freeze({
    createdAt: '2024-01-15T08:30:00Z',
    lastLogin: '2026-07-09T14:22:00Z',
    permissions: Object.freeze(['read', 'write', 'admin']),
    tags: Object.freeze(['vip', 'beta-tester']),
  });
  return Object.freeze({
    user: Object.freeze({ id: 'usr_8a9b2c3d4e5f', username: 'alice_dev', profile: userProfile, metadata: userMeta }),
    role: 'admin',
    cart: Object.freeze({
      items: Object.freeze([
        Object.freeze({ id: 'item_001', name: 'Wireless Keyboard', price: 79.99, quantity: 1 }),
        Object.freeze({ id: 'item_002', name: 'USB-C Hub', price: 49.99, quantity: 2 }),
      ]),
      total: 179.97, currency: 'USD', couponCode: null,
    }),
    preferences: Object.freeze({ currency: 'USD', locale: 'en-US', timezone: 'America/New_York' }),
  });
};

const complexUserContext = makeContext();

/**
 * Data-driven catalog of `/errors` demo routes — each entry pairs a failing template
 * with the context that triggers it; `routes/errors.ts` folds this into GET handlers.
 */
const errorRoutes = Object.freeze([
  { path: 'undefined-variable', template: 'errors/undefined-variable.njk', context: Object.freeze({ user: complexUserContext.user }) },
  { path: 'undefined-function', template: 'errors/undefined-function.njk', context: complexUserContext },
  { path: 'not-a-function', template: 'errors/not-a-function.njk', context: Object.freeze({ user: Object.freeze({ name: 'Alice', status: 'active' }) }) },
  { path: 'undefined-filter', template: 'errors/undefined-filter.njk', context: complexUserContext },
  { path: 'undefined-value', template: 'errors/undefined-value.njk', context: Object.freeze({ product: null }) },
  { path: 'syntax-error', template: 'errors/syntax-error.njk', context: Object.freeze({}) },
  { path: 'parser-expected', template: 'errors/parser-expected.njk', context: Object.freeze({}) },
  { path: 'invalid-lookup', template: 'errors/invalid-lookup.njk', context: Object.freeze({}) },
  { path: 'duplicate-block', template: 'errors/duplicate-block.njk', context: Object.freeze({}) },
  { path: 'unknown-block-tag', template: 'errors/unknown-block-tag.njk', context: Object.freeze({}) },
  { path: 'sort-filter-attr', template: 'errors/sort-filter-attr.njk', context: Object.freeze({ items: Object.freeze([Object.freeze({ name: 'test' })]) }) },
  { path: 'groupby-filter', template: 'errors/groupby-filter.njk', context: Object.freeze({ items: 42 }) },
  { path: 'groupby-filter-attr', template: 'errors/groupby-filter-attr.njk', context: Object.freeze({ items: Object.freeze([Object.freeze({ name: 'test' })]) }) },
]);

export { complexUserContext, errorRoutes };

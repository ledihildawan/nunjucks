import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from '../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const complexUserContext = {
  user: {
    id: 'usr_8a9b2c3d4e5f',
    username: 'alice_dev',
    email: 'alice@example.com',
    profile: {
      firstName: 'Alice',
      lastName: 'Johnson',
      avatar: 'https://example.com/avatars/alice.jpg',
      bio: 'Full-stack developer & open source enthusiast',
      settings: {
        theme: 'dark',
        notifications: true,
        language: 'en-US'
      }
    },
    metadata: {
      createdAt: '2024-01-15T08:30:00Z',
      lastLogin: '2026-07-09T14:22:00Z',
      permissions: ['read', 'write', 'admin'],
      tags: ['vip', 'beta-tester']
    }
  },
  role: 'admin',
  cart: {
    items: [
      { id: 'item_001', name: 'Wireless Keyboard', price: 79.99, quantity: 1 },
      { id: 'item_002', name: 'USB-C Hub', price: 49.99, quantity: 2 }
    ],
    total: 179.97,
    currency: 'USD',
    couponCode: null
  },
  preferences: {
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York'
  }
};

const errorRoutes = [
  { path: '/undefined-variable', template: 'error-undefined-variable.njk', context: { user: complexUserContext.user }, category: 'undefined_variable', desc: 'Variable not in context' },
  { path: '/undefined-function', template: 'error-undefined-function.njk', context: complexUserContext, category: 'undefined_function', desc: 'Function not registered' },
  { path: '/not-a-function', template: 'error-not-a-function.njk', context: { user: { name: 'Alice', status: 'active' } }, category: 'not_a_function', desc: 'Calling non-function value' },
  { path: '/undefined-filter', template: 'error-undefined-filter.njk', context: complexUserContext, category: 'undefined_filter', desc: 'Filter not registered' },
  { path: '/filter-error', template: 'error-filter-error.njk', context: { value: 42, data: complexUserContext }, category: 'filter_error', desc: 'Filter throws during execution' },
  { path: '/undefined-value', template: 'error-undefined-value.njk', context: { product: null }, category: 'undefined_value', desc: 'Nested property is null' },
  { path: '/syntax-error', template: 'error-syntax-error.njk', context: {}, category: 'syntax_error', desc: 'Invalid template syntax' },
  { path: '/no-caller-macro', template: 'error-no-caller-macro.njk', context: {}, category: 'no_caller', desc: 'caller outside macro' },
  { path: '/invalid-lookup', template: 'error-invalid-lookup.njk', context: {}, category: 'invalid_lookup', desc: 'Invalid bracket notation' },
  { path: '/duplicate-block', template: 'error-duplicate-block.njk', context: {}, category: 'duplicate_block', desc: 'Duplicate block definition' },
  { path: '/unknown-block-tag', template: 'error-unknown-block-tag.njk', context: {}, category: 'unknown_block_tag', desc: 'Unmatched closing tag' },
  { path: '/switch', template: 'error-switch.njk', context: {}, category: 'switch', desc: 'Switch statement demo' },
];

import express from 'express';
const router = express.Router();

errorRoutes.forEach(({ path: routePath, template, context }) => {
  router.get(routePath, async (req, res, next) => {
    try {
      const html = await nunjucks.render(template, context, { dev: true, undefined: 'strict', views: VIEWS });
      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  });
});

router.get('/inline-error', async (req, res, next) => {
  try {
    const template = '{{ undefinedVar }}';
    await nunjucks(template, {}, { dev: true, undefined: 'strict' });
    res.send('Should have thrown');
  } catch (err) {
    next(err);
  }
});

router.get('/inline-filter-error', async (req, res, next) => {
  try {
    const template = '{{ "test" |> nonexistentFilter }}';
    await nunjucks(template, {}, { dev: true });
    res.send('Should have thrown');
  } catch (err) {
    next(err);
  }
});

router.get('/inline-syntax-error', async (req, res, next) => {
  try {
    const template = '{% if true %} {% endif %} {{ invalid';
    await nunjucks(template, {}, { dev: true });
    res.send('Should have thrown');
  } catch (err) {
    next(err);
  }
});

router.get('/undefined-block', async (req, res, next) => {
  try {
    res.render('error-undefined-block', {});
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block', async (req, res, next) => {
  try {
    res.render('error-no-super-block', {});
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-include', async (req, res, next) => {
  try {
    res.render('error-invalid-include', {});
  } catch (err) {
    next(err);
  }
});

router.get('/circular-include', async (req, res, next) => {
  try {
    res.render('error-circular-include', {});
  } catch (err) {
    next(err);
  }
});

router.get('/file-not-found', async (req, res, next) => {
  try {
    res.render('error-file-not-found', {});
  } catch (err) {
    next(err);
  }
});

router.get('/filesystem-error', async (req, res, next) => {
  try {
    res.render('error-filesystem-error', {});
  } catch (err) {
    next(err);
  }
});

router.get('/inline-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ undefinedVar }}', {}, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-proto', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.__proto__ }}', { user: {} }, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-constructor', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.constructor }}', { user: {} }, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-process', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.global }}', { user: { global: process } }, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-set', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set user.__proto__ = {} %}', {}, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/slice-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ [1,2,3][::0] }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/list-filter-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ 42 |> list }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/in-operator-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ key in value }}', { key: 'test', value: 123 }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/filter-throw', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ "test" |> throwingFilter }}', {}, {
      dev: true,
      filters: {
        throwingFilter: () => { throw new Error('Filter intentionally threw'); }
      }
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-timeout', async (req, res, next) => {
  try {
    const html = await nunjucks('{% for i in range(0, 100000) %}{{ i }}{% endfor %}', {}, { dev: true, sandbox: true, executionTimeout: 1 });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-context-modify', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set globals = {} %}', {}, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/blocked-context-keys', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.name }}', { user: { name: 'test', __proto__: {} } }, { dev: true, strictMode: true, blockedContextKeys: ['__proto__'] });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dangerous-context', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.name }}', { user: { name: 'test', eval: () => {} } }, { dev: true, strictMode: true, scanContextValues: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dangerous-template', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ (function(){return global})() }}', {}, { dev: true, strictMode: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-size', async (req, res, next) => {
  try {
    const largeTemplate = 'x'.repeat(10000);
    const html = await nunjucks(largeTemplate, {}, { dev: true, maxTemplateSize: 1000 });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-config', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ test }}', { test: 'value' }, { dev: true, executionTimeout: -1 });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-not-string', async (req, res, next) => {
  try {
    const html = await nunjucks(null, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/key-not-found', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ missingKey }}', {}, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/import-error', async (req, res, next) => {
  try {
    res.render('error-import-error', {});
  } catch (err) {
    next(err);
  }
});

router.get('/container-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set x = container.get("missing") %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword-filter', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ value |> upper }}', { value: 'test' }, { dev: true, filters: { myFilter: (v) => v } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword-global', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ myArray }}', { myArray: [1, 2, 3] }, { dev: true, globals: { Array: {} } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/groupby-type-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ items | groupby("missing") }}', { items: [{ name: 'test' }] }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sort-type-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ items | sort("missing") }}', { items: [{ name: 'test' }] }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-value-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ data | dictsort }}', { data: 'not an object' }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-by-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ data | dictsort(false, "invalid") }}', { data: { a: 1, b: 2 } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block-runtime', async (req, res, next) => {
  try {
    const html = await nunjucks('{% block content %}{{ super() }}{% endblock %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-boolean', async (req, res, next) => {
  try {
    const html = await nunjucks('{% if invalidBoolean %}test{% endif %}', { invalidBoolean: 'not a boolean' }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/parser-expected', async (req, res, next) => {
  try {
    const html = await nunjucks('{% for item in items %}{{ item }}{% endfor %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

export { router as errorRouter, errorRoutes };

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
  { path: 'undefined-variable', template: 'error-undefined-variable.njk', context: { user: complexUserContext.user }, category: 'undefined_variable', desc: 'Variable not in context' },
  { path: 'undefined-function', template: 'error-undefined-function.njk', context: complexUserContext, category: 'undefined_function', desc: 'Function not registered' },
  { path: 'not-a-function', template: 'error-not-a-function.njk', context: { user: { name: 'Alice', status: 'active' } }, category: 'not_a_function', desc: 'Calling non-function value' },
  { path: 'undefined-filter', template: 'error-undefined-filter.njk', context: complexUserContext, category: 'undefined_filter', desc: 'Filter not registered' },
  { path: 'filter-error', template: 'error-filter-error.njk', context: { value: 42, data: complexUserContext }, category: 'filter_error', desc: 'Filter throws during execution', filters: { failingAsync: () => { throw new Error('Filter intentionally failed'); } } },
  { path: 'undefined-value', template: 'error-undefined-value.njk', context: { product: null }, category: 'undefined_value', desc: 'Nested property is null' },
  { path: 'syntax-error', template: 'error-syntax-error.njk', context: {}, category: 'syntax_error', desc: 'Invalid template syntax' },
  { path: 'parser-expected', template: 'error-parser-expected.njk', context: {}, category: 'syntax_error', desc: 'Parser expected token ?' },
  { path: 'no-caller-macro', template: 'error-no-caller-macro.njk', context: {}, category: 'no_caller', desc: 'caller outside macro' },
  { path: 'invalid-lookup', template: 'error-invalid-lookup.njk', context: {}, category: 'invalid_lookup', desc: 'Invalid bracket notation' },
  { path: 'duplicate-block', template: 'error-duplicate-block.njk', context: {}, category: 'duplicate_block', desc: 'Duplicate block definition' },
  { path: 'unknown-block-tag', template: 'error-unknown-block-tag.njk', context: {}, category: 'unknown_block_tag', desc: 'Unmatched closing tag' },
];

import express from 'express';
const router = express.Router();

errorRoutes.forEach(({ path: routePath, template, context, filters }) => {
  router.get('/' + routePath, async (req, res, next) => {
    try {
      const options = { dev: true, undefined: 'strict', views: VIEWS };
      if (filters) {
        options.filters = filters;
      }
      const html = await nunjucks.render(template, context, options);
      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  });
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
    const html = await nunjucks.render('error-undefined-block.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block', async (req, res, next) => {
  try {
    const html = await nunjucks('{% block content %}{{ super() }}{% endblock %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-include', async (req, res, next) => {
  try {
    const html = await nunjucks.render('error-invalid-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/circular-include', async (req, res, next) => {
  try {
    const html = await nunjucks.render('error-circular-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/file-not-found', async (req, res, next) => {
  try {
    const html = await nunjucks.render('error-file-not-found.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/filesystem-error', async (req, res, next) => {
  try {
    const html = await nunjucks.render('error-filesystem-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
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
    const html = await nunjucks('{{ password }}', { password: 'secret123' }, { dev: true, strictMode: true, blockedContextKeys: ['password'] });
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
    const html = await nunjucks('{% set x = eval("1+1") %}{{ x }}', {}, { dev: true, strictMode: true });
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
    res.status(500).type('html').send(err.output());
  }
});

router.get('/key-not-found', async (req, res, next) => {
  try {
    const nunjucksInstance = nunjucks.configure({ undefined: 'strict' });
    const html = await nunjucksInstance('{{ missingKey }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/import-error', async (req, res, next) => {
  try {
    const html = await nunjucks.render('error-import-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set x = container.get("missing") %}', { container: { get: undefined } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword-filter', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v) => v } });
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
    const html = await nunjucks('{{ items |> groupby("missing") }}', { items: [{ name: 'test' }] }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sort-type-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ items |> sort("missing") }}', { items: [{ name: 'test' }] }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-value-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ data |> dictsort }}', { data: 'not an object' }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-by-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ data |> dictsort(false, "invalid") }}', { data: { a: 1, b: 2 } }, { dev: true });
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

router.get('/', (req, res) => {
  const allRoutes = [
    ...errorRoutes.map(r => ({ path: r.path, desc: r.desc })),
    { path: 'inline-filter-error', desc: 'Inline template undefined filter' },
    { path: 'inline-syntax-error', desc: 'Inline template syntax error' },
    { path: 'inline-error', desc: 'Inline template undefined variable' },
    { path: 'undefined-block', desc: 'Block not in parent template' },
    { path: 'no-super-block', desc: 'super() called without parent block' },
    { path: 'invalid-include', desc: 'Non-string template name for include' },
    { path: 'circular-include', desc: 'Template includes itself' },
    { path: 'file-not-found', desc: 'Included template not found' },
    { path: 'filesystem-error', desc: 'Absolute path with non-existent file' },
    { path: 'sandbox-proto', desc: 'Sandbox blocks __proto__ access' },
    { path: 'sandbox-constructor', desc: 'Sandbox blocks constructor access' },
    { path: 'sandbox-process', desc: 'Sandbox blocks process access' },
    { path: 'sandbox-set', desc: 'Sandbox blocks setting __proto__' },
    { path: 'sandbox-timeout', desc: 'Template execution timed out' },
    { path: 'sandbox-context-modify', desc: 'Cannot modify sandboxed context' },
    { path: 'slice-error', desc: 'Slice step cannot be zero' },
    { path: 'list-filter-error', desc: 'List filter requires iterable' },
    { path: 'in-operator-error', desc: 'In operator on primitive type' },
    { path: 'filter-throw', desc: 'Filter throws during execution' },
    { path: 'blocked-context-keys', desc: 'Context contains blocked keys' },
    { path: 'dangerous-context', desc: 'Context contains dangerous values' },
    { path: 'dangerous-template', desc: 'Template contains dangerous code' },
    { path: 'template-size', desc: 'Template exceeds maximum size' },
    { path: 'invalid-config', desc: 'Invalid config (negative timeout)' },
    { path: 'template-not-string', desc: 'Template must be a string' },
    { path: 'key-not-found', desc: 'Key not found in context (strict mode)' },
    { path: 'import-error', desc: 'Cannot import symbol' },
    { path: 'container-error', desc: 'Container not registered' },
    { path: 'groupby-type-error', desc: 'Groupby attribute undefined' },
    { path: 'sort-type-error', desc: 'Sort attribute undefined' },
    { path: 'dictsort-value-error', desc: 'Dictsort requires object' },
    { path: 'dictsort-by-error', desc: 'Dictsort invalid by param' },
    { path: 'no-super-block-runtime', desc: 'super() without parent block' },
    { path: 'reserved-keyword-filter', desc: 'Using reserved word as filter' },
    { path: 'reserved-keyword-global', desc: 'Using reserved word as global' },
  ];

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Error Routes</title>
  <style>
    body { font-family: monospace; margin: 20px; }
    h1 { font-size: 18px; }
    ul { list-style: none; padding: 0; }
    li { margin: 5px 0; }
    a { color: #c00; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .count { color: #666; }
  </style>
</head>
<body>
  <h1>Error Routes (${allRoutes.length})</h1>
  <ul>
    ${allRoutes.map(r => `<li><a href="/errors/${r.path}">${r.path}</a> - ${r.desc}</li>`).join('\n    ')}
  </ul>
</body>
</html>`;

  res.type('html').send(html);
});

export { router as errorRouter, errorRoutes };

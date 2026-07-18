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
  { path: 'undefined-variable', template: 'errors/undefined-variable.njk', context: { user: complexUserContext.user }, category: 'undefined_variable', desc: 'Variable not in context' },
  { path: 'undefined-function', template: 'errors/undefined-function.njk', context: complexUserContext, category: 'undefined_function', desc: 'Function not registered' },
  { path: 'not-a-function', template: 'errors/not-a-function.njk', context: { user: { name: 'Alice', status: 'active' } }, category: 'not_a_function', desc: 'Calling non-function value' },
  { path: 'undefined-filter', template: 'errors/undefined-filter.njk', context: complexUserContext, category: 'undefined_filter', desc: 'Filter not registered' },
  { path: 'filter-error', template: 'errors/filter-error.njk', context: { value: 42, data: complexUserContext }, category: 'filter_error', desc: 'Filter throws during execution', filters: { failingAsync: () => { throw new Error('Filter intentionally failed'); } } },
  { path: 'undefined-value', template: 'errors/undefined-value.njk', context: { product: null }, category: 'undefined_value', desc: 'Nested property is null' },
  { path: 'syntax-error', template: 'errors/syntax-error.njk', context: {}, category: 'syntax_error', desc: 'Invalid template syntax' },
  { path: 'parser-expected', template: 'errors/parser-expected.njk', context: {}, category: 'syntax_error', desc: 'Parser expected token ?' },
  { path: 'no-caller-macro', template: 'errors/no-caller-macro.njk', context: {}, category: 'no_caller', desc: 'caller outside macro' },
  { path: 'invalid-lookup', template: 'errors/invalid-lookup.njk', context: {}, category: 'invalid_lookup', desc: 'Invalid bracket notation' },
  { path: 'duplicate-block', template: 'errors/duplicate-block.njk', context: {}, category: 'duplicate_block', desc: 'Duplicate block definition' },
  { path: 'unknown-block-tag', template: 'errors/unknown-block-tag.njk', context: {}, category: 'unknown_block_tag', desc: 'Unmatched closing tag' },
  { path: 'sort-filter-attr', template: 'errors/sort-filter-attr.njk', context: { items: [{ name: 'test' }] }, category: 'sort_filter_attr', desc: 'Sort attribute undefined' },
  { path: 'groupby-filter', template: 'errors/groupby-filter.njk', context: { items: [{ name: 'test' }] }, category: 'groupby_filter', desc: 'Groupby filter type error' },
  { path: 'groupby-filter-attr', template: 'errors/groupby-filter-attr.njk', context: { items: [{ name: 'test' }] }, category: 'groupby_filter_attr', desc: 'Groupby attribute undefined' },
  { path: 'dictsort-filter', template: 'errors/dictsort-filter.njk', context: { data: 'not an object' }, category: 'dictsort_filter', desc: 'Dictsort requires object' },
  { path: 'dictsort-filter-by', template: 'errors/dictsort-filter-by.njk', context: { data: { a: 1, b: 2 } }, category: 'dictsort_filter_by', desc: 'Dictsort invalid by param' },
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
    const html = await nunjucks.render('errors/undefined-block.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
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

router.get('/caller-outside-call', async (req, res, next) => {
  try {
    const html = await nunjucks('{% macro foo() %}{{ caller() }}{% endmacro %}{{ foo() }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block-template', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/no-super-block.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-include', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/invalid-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/circular-include', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/circular-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/file-not-found', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/file-not-found.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/filesystem-error', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/filesystem-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
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
    const html = await nunjucks('{{ user.name }}', { user: { name: 'test' }, eval: () => {} }, { dev: true, strictMode: true, scanContextValues: true });
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

router.get('/key-not-found', async (req, res, next) => {
  try {
    const nunjucksInstance = nunjucks.configure({ undefined: 'strict' });
    const html = await nunjucksInstance(`
      
      {{ missingKey }}
       
      `, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/import-error', async (req, res, next) => {
  try {
    const html = await nunjucks.render('errors/import-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
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

router.get('/unknown-block-runtime', async (req, res, next) => {
  try {
    const html = await nunjucks('{% extends "base.njk" %}{% block nonexistent %}{{ super() }}{% endblock %}', {}, { dev: true, views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/expected-variable-end', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.name ', { user: { name: 'test' } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/parser-unexpected-token', async (req, res, next) => {
  try {
    const html = await nunjucks('{% if true %}{% endif %}{{ ', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-access', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.global }}', { user: { global: process } }, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-allowlist', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ customVar }}', { customVar: 'test' }, { dev: true, sandbox: true, sandboxAllowlist: ['allowedVar'], sandboxMode: 'allowlist' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-code-execution', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set x = (function(){}).call() %}', {}, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-context-error', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ user.something }}', { user: undefined }, { dev: true, sandbox: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-factory', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set x = container.get("test") %}', { container: { get: 'not a function' } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-not-registered', async (req, res, next) => {
  try {
    const html = await nunjucks('{% set x = myContainer.get("test") %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-must-be-string', async (req, res, next) => {
  try {
    const html = await nunjucks(123, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-null', async (req, res, next) => {
  try {
    const html = await nunjucks(null, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/undefined-value-match', async (req, res, next) => {
  try {
    const html = await nunjucks('{{ product.name }}', { product: { test: 'test' } }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const groups = [
      {
        name: 'UNDEFINED_VARIABLE',
        items: [
          { path: 'undefined-variable', desc: 'Variable not in context' },
          { path: 'undefined-value', desc: 'Nested property is null' },
          { path: 'undefined-value-match', desc: 'Attempted to output undefined value' },
          { path: 'inline-error', desc: 'Inline template undefined variable' },
          { path: 'key-not-found', desc: 'Key not found in context (strict mode)' },
          { path: 'sandbox-context-error', desc: 'Sandbox context error (undefined)' },
        ]
      },
      {
        name: 'UNDEFINED_FUNCTION',
        items: [
          { path: 'undefined-function', desc: 'Function not registered' },
          { path: 'container-error', desc: 'Container get returns undefined' },
          { path: 'container-not-registered', desc: 'Container not registered' },
          { path: 'sandbox-timeout', desc: 'Sandbox timeout function not found' },
        ]
      },
      {
        name: 'UNDEFINED_FILTER',
        items: [
          { path: 'undefined-filter', desc: 'Filter not registered' },
          { path: 'sort-filter-attr', desc: 'Sort filter attribute undefined' },
          { path: 'groupby-filter', desc: 'Groupby filter not registered' },
          { path: 'groupby-filter-attr', desc: 'Groupby filter attribute undefined' },
          { path: 'dictsort-filter', desc: 'Dictsort filter not registered' },
          { path: 'dictsort-filter-by', desc: 'Dictsort filter by attribute undefined' },
          { path: 'inline-filter-error', desc: 'Inline template undefined filter' },
        ]
      },
      {
        name: 'UNDEFINED_BLOCK',
        items: [
          { path: 'undefined-block', desc: 'Block not in parent template' },
          { path: 'unknown-block-runtime', desc: 'Block not found in parent' },
        ]
      },
      {
        name: 'NOT_A_FUNCTION',
        items: [
          { path: 'not-a-function', desc: 'Calling non-function value' },
        ]
      },
      {
        name: 'FILTER_TYPE_ERROR',
        items: [
          { path: 'list-filter-error', desc: 'List filter requires iterable' },
        ]
      },
      {
        name: 'OPERATOR_ERROR',
        items: [
          { path: 'in-operator-error', desc: 'In operator on primitive type' },
        ]
      },
      {
        name: 'FILTER_ATTR_ERROR',
        items: [
          { path: 'groupby-type-error', desc: 'Groupby attribute undefined' },
          { path: 'sort-type-error', desc: 'Sort attribute undefined' },
          { path: 'dictsort-value-error', desc: 'Dictsort requires object' },
          { path: 'dictsort-by-error', desc: 'Dictsort invalid by param' },
        ]
      },
      {
        name: 'PARSER_ERROR',
        items: [
          { path: 'syntax-error', desc: 'Invalid template syntax' },
          { path: 'parser-expected', desc: 'Parser expected different token' },
          { path: 'inline-syntax-error', desc: 'Inline template syntax error' },
          { path: 'invalid-lookup', desc: 'Invalid bracket notation' },
          { path: 'unknown-block-tag', desc: 'Unknown block tag' },
          { path: 'expected-variable-end', desc: 'Expected variable end' },
          { path: 'parser-unexpected-token', desc: 'Unexpected token while parsing' },
          { path: 'sandbox-code-execution', desc: 'Code execution blocked (parser)' },
          { path: 'slice-error', desc: 'Slice step cannot be zero' },
        ]
      },
      {
        name: 'DUPLICATE_BLOCK',
        items: [
          { path: 'duplicate-block', desc: 'Duplicate block definition' },
        ]
      },
      {
        name: 'RESERVED_KEYWORD_CONTEXT',
        items: [
          { path: 'no-caller-macro', desc: 'caller outside macro context' },
          { path: 'caller-outside-call', desc: 'caller() used outside call block' },
        ]
      },
      {
        name: 'RUNTIME_ERROR',
        items: [
          { path: 'filter-error', desc: 'Filter throws during execution' },
          { path: 'no-super-block', desc: 'super() called without parent block' },
          { path: 'filter-throw', desc: 'Inline filter throws during execution' },
        ]
      },
      {
        name: 'FILE_NOT_FOUND',
        items: [
          { path: 'no-super-block-template', desc: 'super() in child without parent block' },
          { path: 'circular-include', desc: 'Template includes itself' },
          { path: 'file-not-found', desc: 'Included template not found' },
          { path: 'filesystem-error', desc: 'Absolute path with non-existent file' },
          { path: 'import-error', desc: 'Cannot import symbol' },
        ]
      },
      {
        name: 'INVALID_INCLUDE',
        items: [
          { path: 'invalid-include', desc: 'Non-string template name for include' },
        ]
      },
      {
        name: 'RENDER_ERROR',
        items: [
          { path: 'sandbox-set', desc: 'Sandbox blocks setting __proto__' },
          { path: 'sandbox-context-modify', desc: 'Cannot modify sandboxed context' },
          { path: 'sandbox-allowlist', desc: 'Variable not in sandbox allowlist' },
          { path: 'reserved-keyword-filter', desc: 'Using reserved word as filter' },
          { path: 'reserved-keyword-global', desc: 'Using reserved word as global' },
          { path: 'template-size', desc: 'Template exceeds maximum size' },
          { path: 'invalid-config', desc: 'Invalid config (negative timeout)' },
          { path: 'blocked-context-keys', desc: 'Context contains blocked keys' },
          { path: 'dangerous-context', desc: 'Context contains dangerous values' },
          { path: 'dangerous-template', desc: 'Template contains dangerous code' },
        ]
      },
      {
        name: 'SANDBOX_ACCESS',
        items: [
          { path: 'sandbox-proto', desc: 'Sandbox blocks __proto__ access' },
          { path: 'sandbox-constructor', desc: 'Sandbox blocks constructor access' },
          { path: 'sandbox-process', desc: 'Sandbox blocks process access' },
          { path: 'sandbox-access', desc: 'Cannot access in sandbox mode' },
        ]
      },
      {
        name: 'TEMPLATE_MUST_BE_STRING',
        items: [
          { path: 'template-must-be-string', desc: 'Template must be string' },
          { path: 'template-null', desc: 'Template is null' },
        ]
      },
      {
        name: 'UNKNOWN',
        items: [
          { path: 'container-factory', desc: 'Container factory error (unclear error type)' },
        ]
      },
    ];

    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    const html = await nunjucks.render('errors/index.njk', { groups, total }, { dev: true, views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

export { router as errorRouter, errorRoutes };

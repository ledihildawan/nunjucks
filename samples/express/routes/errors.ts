import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Router } from 'express';
import { renderTemplate } from '../lib/render-template.ts';
import { createSandboxedContext } from '@nunjucks/runtime';
import type { ErrorRoute, ErrorGroup } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

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

const errorRoutes: ErrorRoute[] = [
  { path: 'undefined-variable', template: 'errors/undefined-variable.njk', context: { user: complexUserContext.user }, category: 'undefined_variable', desc: 'Variable not in context' },
  { path: 'undefined-function', template: 'errors/undefined-function.njk', context: complexUserContext, category: 'undefined_function', desc: 'Function not registered' },
  { path: 'not-a-function', template: 'errors/not-a-function.njk', context: { user: { name: 'Alice', status: 'active' } }, category: 'not_a_function', desc: 'Calling non-function value' },
  { path: 'undefined-filter', template: 'errors/undefined-filter.njk', context: complexUserContext, category: 'undefined_filter', desc: 'Filter not registered' },
  { path: 'filter-error', template: 'errors/filter-error.njk', context: { value: 42, data: complexUserContext }, category: 'filter_error', desc: 'Filter throws during execution', filters: { failingAsync: () => { throw new Error('Filter intentionally failed'); } } },
  { path: 'undefined-value', template: 'errors/undefined-value.njk', context: { product: null }, category: 'undefined_value', desc: 'Nested property is null' },
  { path: 'syntax-error', template: 'errors/syntax-error.njk', context: {}, category: 'syntax_error', desc: 'Invalid template syntax' },
  { path: 'parser-expected', template: 'errors/parser-expected.njk', context: {}, category: 'syntax_error', desc: 'Parser expected token ?' },
  { path: 'invalid-lookup', template: 'errors/invalid-lookup.njk', context: {}, category: 'invalid_lookup', desc: 'Invalid bracket notation' },
  { path: 'duplicate-block', template: 'errors/duplicate-block.njk', context: {}, category: 'duplicate_block', desc: 'Duplicate block definition' },
  { path: 'unknown-block-tag', template: 'errors/unknown-block-tag.njk', context: {}, category: 'unknown_block_tag', desc: 'Unmatched closing tag' },
  { path: 'sort-filter-attr', template: 'errors/sort-filter-attr.njk', context: { items: [{ name: 'test' }] }, category: 'sort_filter_attr', desc: 'Sort attribute undefined' },
  { path: 'groupby-filter', template: 'errors/groupby-filter.njk', context: { items: 42 }, category: 'groupby_filter', desc: 'Groupby filter type error' },
  { path: 'groupby-filter-attr', template: 'errors/groupby-filter-attr.njk', context: { items: [{ name: 'test' }] }, category: 'groupby_filter_attr', desc: 'Groupby attribute undefined' },
  { path: 'dictsort-filter', template: 'errors/dictsort-filter.njk', context: { data: 'not an object' }, category: 'dictsort_filter', desc: 'Dictsort requires object' },
  { path: 'dictsort-filter-by', template: 'errors/dictsort-filter-by.njk', context: { data: { a: 1, b: 2 } }, category: 'dictsort_filter_by', desc: 'Dictsort invalid by param' },
];

const router: Router = express.Router();

errorRoutes.forEach(({ path: routePath, template, context, filters }) => {
  router.get(`/${routePath}`, async (_req, res, next) => {
    try {
      const options: Record<string, unknown> = { dev: true, undefined: 'strict', views: VIEWS };
      if (filters) {
        options.filters = filters;
      }
      const html = await renderTemplate(template, context, options);
      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  });
});

router.get('/inline-filter-error', async (_req, res, next) => {
  try {
    await renderTemplate('{{ "test" |> nonexistentFilter }}', {}, { dev: true });
    res.send('Should have thrown');
  } catch (err) {
    next(err);
  }
});

router.get('/inline-syntax-error', async (_req, res, next) => {
  try {
    await renderTemplate('{% if true %} {% endif %} {{ invalid', {}, { dev: true });
    res.send('Should have thrown');
  } catch (err) {
    next(err);
  }
});

router.get('/undefined-block', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/undefined-block.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% block content %}{{ super() }}{% endblock %}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ super() }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-super-block-template', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/no-super-block.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-include', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/invalid-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/circular-include', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/circular-include.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/file-not-found', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/file-not-found.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/filesystem-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/filesystem-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/inline-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ undefinedVar }}', {}, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-proto', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.__proto__ }}', { user: {} }, { dev: true, security: { sandbox: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-constructor', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.constructor }}', { user: {} }, { dev: true, security: { sandbox: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-process', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.global }}', { user: { global: process } }, { dev: true, security: { sandbox: true, contextStrict: 'error' } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/slice-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ [1,2,3][::0] }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/list-filter-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ 42 |> list }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/in-operator-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ key in value }}', { key: 'test', value: 123 }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/filter-throw', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ "test" |> throwingFilter }}', {}, {
      dev: true,
      filters: {
        throwingFilter: () => {
          try {
            throw new Error('Filter intentionally threw');
          } catch (e) {
            const err = new Error(`Filter throwingFilter threw: ${(e as Error).message}`);
            (err as Error & { code: string; subject: string }).code = 'FILTER_ERROR';
            (err as unknown as Record<string, unknown>).subject = 'throwingFilter';
            throw err;
          }
        }
      }
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-timeout', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% for i in range(0, 100000) %}{{ i }}{% endfor %}', {}, { dev: true, security: { sandbox: true }, limits: { executionTimeout: 1 } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-context-modify', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ modifyContext() }}', {
      modifyContext: () => {
        const context = createSandboxedContext({ user: 'alice' }, true);
        (context as { user?: string }).user = 'bob';
      }
    }, { dev: true, security: { sandbox: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/blocked-context-keys', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ password }}', { password: 'secret123' }, { dev: true, security: { strictMode: true, blockedContextKeys: ['password'] } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/blocked-custom-key', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ creditCard }}', { creditCard: '4111-1111-1111-1111' }, { dev: true, security: { strictMode: true, blockedContextKeys: ['creditCard'] } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/no-blocked-context-keys', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ password.upper() }}', { password: 'mySecretValue123', apiKey: 'abc-def-ghi' }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dangerous-context', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ env.NODE_ENV }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dangerous-context-values', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.name }}', { user: { name: 'test', eval: 'profile label' }, globalThis }, { dev: true, security: { strictMode: true, scanContextValues: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dangerous-template', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ eval("1+1") }}', {}, { dev: true, security: { strictMode: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-size', async (_req, res, next) => {
  try {
    const largeTemplate = 'x'.repeat(10000);
    const html = await renderTemplate(largeTemplate, {}, { dev: true, limits: { maxTemplateSize: 1000 } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invalid-config', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ test }}', { test: 'value' }, { dev: true, limits: { executionTimeout: -1 } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/key-not-found', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ missingKey }}', {}, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/import-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/import-error.njk', {}, { dev: true, undefined: 'strict', views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ container.get("missing") }}', { container: { get: undefined } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword-filter', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v: unknown) => v } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/reserved-keyword-global', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ myArray }}', { myArray: [1, 2, 3] }, { dev: true, globals: { Array: {} } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/groupby-type-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ items |> groupby("missing") }}', { items: [{ name: 'test' }] }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sort-type-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ items |> sort("missing") }}', { items: [{ name: 'test' }] }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-value-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ data |> dictsort }}', { data: 'not an object' }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/dictsort-by-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ data |> dictsort(false, "invalid") }}', { data: { a: 1, b: 2 } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/unknown-block-runtime', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% extends "base.njk" %}{% block nonexistent %}{{ super() }}{% endblock %}', {}, { dev: true, views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/expected-variable-end', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.name ', { user: { name: 'test' } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/parser-unexpected-token', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% if true %}{% endif %}{{ ', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-access', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ global }}', { global: process }, { dev: true, security: { sandbox: true, contextStrict: false } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-allowlist', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ customVar }}', { customVar: 'test' }, { dev: true, security: { sandbox: true, sandboxAllowlist: ['allowedVar'], sandboxMode: 'allowlist' } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-code-execution', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ setTimeout("alert(1)", 0) }}', { setTimeout }, { dev: true, security: { sandbox: true } });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/sandbox-context-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.something }}', { user: undefined }, { dev: true, security: { sandbox: true }, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-factory', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ container.get("test") }}', { container: { get: 'not a function' } }, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/container-not-registered', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ myContainer.get("test") }}', {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-must-be-string', async (_req, res, next) => {
  try {
    const html = await renderTemplate(123 as unknown as string, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/template-null', async (_req, res, next) => {
  try {
    const html = await renderTemplate(null as unknown as string, {}, { dev: true });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/undefined-value-match', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ product.name }}', { product: { test: 'test' } }, { dev: true, undefined: 'strict' });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const groups: ErrorGroup[] = [
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
          { path: 'groupby-filter', desc: 'Groupby filter requires an array' },
          { path: 'groupby-filter-attr', desc: 'Groupby filter attribute undefined' },
          { path: 'dictsort-filter', desc: 'Dictsort filter requires object' },
          { path: 'dictsort-filter-by', desc: 'Dictsort filter by mode invalid' },
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
          { path: 'reserved-keyword', desc: 'Reserved keyword used as a function call' },
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
          { path: 'sandbox-context-modify', desc: 'Cannot modify sandboxed context' },
          { path: 'sandbox-allowlist', desc: 'Variable not in sandbox allowlist' },
          { path: 'reserved-keyword-filter', desc: 'Using reserved word as filter' },
          { path: 'reserved-keyword-global', desc: 'Using reserved word as global' },
          { path: 'template-size', desc: 'Template exceeds maximum size' },
          { path: 'invalid-config', desc: 'Invalid config (negative timeout)' },
          { path: 'blocked-context-keys', desc: 'Context contains blocked keys (dynamic redaction)' },
          { path: 'blocked-custom-key', desc: 'Custom blocked key (no heuristic)' },
          { path: 'no-blocked-context-keys', desc: 'No blocked keys: library does not assume' },
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
    const html = await renderTemplate('errors/index.njk', { groups, total }, { dev: true, views: VIEWS });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

export { router as errorRouter, errorRoutes };

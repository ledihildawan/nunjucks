import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Router } from 'express';
import { renderTemplate } from '../lib/render-template.ts';
import { createSandboxedContext } from '@nunjucks/runtime';
import type { NunjucksConfig } from '@nunjucks/core';
import type { ErrorRoute } from './types.ts';
import { errorGroups } from './errors-index-groups.ts';

interface EnrichedFilterError extends Error {
  code: string;
  subject: string;
}

// WHY: the public nunjucks.render(template: string, ...) signature strictly types the template parameter,
// so there is no runtime-validated path to feed a non-string through the engine. This helper centralises the
// deliberate type-bypass used by the bad-input demo routes (/template-must-be-string, /template-null) so the
// escape hatch is isolated, self-documenting, and not copy-pasted inline at each call site.
const injectInvalidTemplate = (value: unknown): string => value as string;

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
      const config: NunjucksConfig = { dev: true, undefined: 'strict', views: VIEWS, ...(filters ? { filters } : {}) };
      const html = await renderTemplate(template, { context, config });
      res.type('html').send(html);
    } catch (err: unknown) {
      next(err as Error);
    }
  });
});

router.get('/inline-filter-error', async (_req, res, next) => {
  try {
    await renderTemplate('{{ "test" |> nonexistentFilter }}', { context: {}, config: { dev: true } });
    res.send('Should have thrown');
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/inline-syntax-error', async (_req, res, next) => {
  try {
    await renderTemplate('{% if true %} {% endif %} {{ invalid', { context: {}, config: { dev: true } });
    res.send('Should have thrown');
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/undefined-block', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/undefined-block.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/no-super-block', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% block content %}{{ super() }}{% endblock %}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/reserved-keyword', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ super() }}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/no-super-block-template', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/no-super-block.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/invalid-include', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/invalid-include.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/circular-include', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/circular-include.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/file-not-found', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/file-not-found.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/filesystem-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/filesystem-error.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/inline-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ undefinedVar }}', { context: {}, config: { dev: true, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-proto', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.__proto__ }}', { context: { user: {} }, config: { dev: true, security: { sandbox: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-constructor', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.constructor }}', { context: { user: {} }, config: { dev: true, security: { sandbox: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-process', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.global }}', { context: { user: { global: process } }, config: { dev: true, security: { sandbox: true, contextStrict: 'error' } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/slice-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ [1,2,3][::0] }}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/list-filter-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ 42 |> list }}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/in-operator-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ key in value }}', { context: { key: 'test', value: 123 }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/filter-throw', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ "test" |> throwingFilter }}', { context: {}, config: {
      dev: true,
      filters: {
        throwingFilter: () => {
          try {
            throw new Error('Filter intentionally threw');
          } catch (e) {
            const enriched: EnrichedFilterError = Object.assign(
              new Error(`Filter throwingFilter threw: ${(e as Error).message}`),
              { code: 'FILTER_ERROR', subject: 'throwingFilter' },
            );
            throw enriched;
          }
        }
      }
    } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-timeout', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% for i in range(0, 100000) %}{{ i }}{% endfor %}', { context: {}, config: { dev: true, security: { sandbox: true }, limits: { executionTimeout: 1 } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-context-modify', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ modifyContext() }}', { context: {
      // WHY: intentional mutation to test sandbox write-block — this callback attempts to reassign a property on the sandboxed context, which the sandbox proxy must reject.
      modifyContext: () => {
        const context = createSandboxedContext({ context: { user: 'alice' }, sandboxEnabled: true });
        (context as { user?: string }).user = 'bob';
      }
    }, config: { dev: true, security: { sandbox: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/blocked-context-keys', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ password }}', { context: { password: 'secret123' }, config: { dev: true, security: { strictMode: true, blockedContextKeys: ['password'] } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/blocked-custom-key', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ creditCard }}', { context: { creditCard: '4111-1111-1111-1111' }, config: { dev: true, security: { strictMode: true, blockedContextKeys: ['creditCard'] } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/no-blocked-context-keys', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ password.upper() }}', { context: { password: 'mySecretValue123', apiKey: 'abc-def-ghi' }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/dangerous-context', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ env.NODE_ENV }}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/dangerous-context-values', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.name }}', { context: { user: { name: 'test', eval: 'profile label' }, globalThis }, config: { dev: true, security: { strictMode: true, scanContextValues: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/dangerous-template', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ eval("1+1") }}', { context: {}, config: { dev: true, security: { strictMode: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/template-size', async (_req, res, next) => {
  try {
    const largeTemplate = 'x'.repeat(10000);
    const html = await renderTemplate(largeTemplate, { context: {}, config: { dev: true, limits: { maxTemplateSize: 1000 } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/invalid-config', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ test }}', { context: { test: 'value' }, config: { dev: true, limits: { executionTimeout: -1 } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/key-not-found', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ missingKey }}', { context: {}, config: { dev: true, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/import-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('errors/import-error.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/container-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ container.get("missing") }}', { context: { container: { get: undefined } }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/reserved-keyword-filter', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ value }}', { context: { value: 'test' }, config: { dev: true, filters: { 'if': (v: unknown) => v } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/reserved-keyword-global', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ myArray }}', { context: { myArray: [1, 2, 3] }, config: { dev: true, globals: { Array: {} } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/groupby-type-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ items |> groupby("missing") }}', { context: { items: [{ name: 'test' }] }, config: { dev: true, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sort-type-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ items |> sort("missing") }}', { context: { items: [{ name: 'test' }] }, config: { dev: true, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/dictsort-value-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ data |> dictsort }}', { context: { data: 'not an object' }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/dictsort-by-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ data |> dictsort(false, "invalid") }}', { context: { data: { a: 1, b: 2 } }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/unknown-block-runtime', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% extends "base.njk" %}{% block nonexistent %}{{ super() }}{% endblock %}', { context: {}, config: { dev: true, views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/expected-variable-end', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.name ', { context: { user: { name: 'test' } }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/parser-unexpected-token', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{% if true %}{% endif %}{{ ', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-access', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ global }}', { context: { global: process }, config: { dev: true, security: { sandbox: true, contextStrict: false } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-allowlist', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ customVar }}', { context: { customVar: 'test' }, config: { dev: true, security: { sandbox: true, sandboxAllowlist: ['allowedVar'], sandboxMode: 'allowlist' } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-code-execution', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ setTimeout("alert(1)", 0) }}', { context: { setTimeout }, config: { dev: true, security: { sandbox: true } } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/sandbox-context-error', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ user.something }}', { context: { user: undefined }, config: { dev: true, security: { sandbox: true }, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/container-factory', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ container.get("test") }}', { context: { container: { get: 'not a function' } }, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/container-not-registered', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ myContainer.get("test") }}', { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/template-must-be-string', async (_req, res, next) => {
  try {
    const html = await renderTemplate(injectInvalidTemplate(123), { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/template-null', async (_req, res, next) => {
  try {
    const html = await renderTemplate(injectInvalidTemplate(null), { context: {}, config: { dev: true } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/undefined-value-match', async (_req, res, next) => {
  try {
    const html = await renderTemplate('{{ product.name }}', { context: { product: { test: 'test' } }, config: { dev: true, undefined: 'strict' } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const total = errorGroups.reduce((sum, g) => sum + g.items.length, 0);
    const html = await renderTemplate('errors/index.njk', { context: { groups: errorGroups, total }, config: { dev: true, views: VIEWS } });
    res.type('html').send(html);
  } catch (err: unknown) {
    next(err as Error);
  }
});

export { router as errorRouter, errorRoutes };

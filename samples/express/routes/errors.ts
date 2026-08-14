import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { createSandboxedContext } from '@nunjucks/runtime';
import type { NunjucksConfig } from '@nunjucks/core';
import { errorGroups } from '../lib/domain/error-route-metadata.ts';
import { errorRoutes } from '../lib/domain/error-route-data.ts';
import { createTemplateSource, escapeHtml } from '../lib/domain/error-route-utils.ts';
import type { EnrichedFilterError } from '../lib/domain/error-route-types.ts';
import { VIEWS } from '../lib/io/views-path.ts';

const router: Router = express.Router();

errorRoutes.reduce<Router>((acc, { path: routePath, template, context }) => {
  const config: NunjucksConfig = { dev: true, undefined: 'strict', views: VIEWS };
  acc.get(`/${routePath}`, async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult(res, next, await renderTemplate(template, { context, config }));
  });
  return acc;
}, router);

// WHY: filter-error overrides the data-driven route to inject a throwing filter (formerly buried in
// lib/domain/error-route-data.ts). The shell owns the throwing filters; the domain only owns the
// template + context data.
router.get('/filter-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/filter-error.njk', {
    context: { value: 42, data: { user: 'alice' } },
    config: {
      dev: true,
      undefined: 'strict',
      views: VIEWS,
      filters: {
        failingAsync: () => { throw new Error('Filter intentionally failed'); },
      },
    },
  }));
});

// WHY: inverted assertion — renderTemplate reports failure via Result, so an ok render means the error scenario silently passed.
router.get('/inline-filter-error', async (_req: Request, res: Response) => {
  const result = await renderTemplate('{{ "test" |> nonexistentFilter }}', { context: {}, config: { dev: true } });
  if (result.ok) {
    res.type('html').send('Should have thrown');
    return;
  }
  res.status(400).send(`<pre>${escapeHtml(result.error.message)}</pre>`);
});

// WHY: inverted assertion — renderTemplate reports failure via Result, so an ok render means the error scenario silently passed.
router.get('/inline-syntax-error', async (_req: Request, res: Response) => {
  const result = await renderTemplate('{% if true %} {% endif %} {{ invalid', { context: {}, config: { dev: true } });
  if (result.ok) {
    res.type('html').send('Should have thrown');
    return;
  }
  res.status(400).send(`<pre>${escapeHtml(result.error.message)}</pre>`);
});

router.get('/undefined-block', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/undefined-block.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/no-super-block', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{% block content %}{{ super() }}{% endblock %}', { context: {}, config: { dev: true } }));
});

router.get('/reserved-keyword', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ super() }}', { context: {}, config: { dev: true } }));
});

router.get('/no-super-block-template', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/no-super-block.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/invalid-include', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/invalid-include.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/circular-include', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/circular-include.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/file-not-found', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/file-not-found.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/filesystem-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/filesystem-error.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/inline-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ undefinedVar }}', { context: {}, config: { dev: true, undefined: 'strict' } }));
});

router.get('/sandbox-proto', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.__proto__ }}', { context: { user: {} }, config: { dev: true, security: { sandbox: true } } }));
});

router.get('/sandbox-constructor', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.constructor }}', { context: { user: {} }, config: { dev: true, security: { sandbox: true } } }));
});

// WHY: intentional sandbox probe — hands node's process through the context so the sandbox proxy must reject {{ user.global }} access.
router.get('/sandbox-process', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.global }}', { context: { user: { global: process } }, config: { dev: true, security: { sandbox: true, contextStrict: 'error' } } }));
});

router.get('/slice-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ [1,2,3][::0] }}', { context: {}, config: { dev: true } }));
});

router.get('/list-filter-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ 42 |> list }}', { context: {}, config: { dev: true } }));
});

router.get('/in-operator-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ key in value }}', { context: { key: 'test', value: 123 }, config: { dev: true } }));
});

router.get('/filter-throw', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ "test" |> throwingFilter }}', { context: {}, config: {
    dev: true,
    filters: {
      throwingFilter: () => {
        const baseError = new Error('Filter intentionally threw');
        const enriched: EnrichedFilterError = Object.assign(
          new Error(`Filter throwingFilter threw: ${baseError.message}`),
          { code: 'FILTER_ERROR', subject: 'throwingFilter' },
        );
        throw enriched;
      }
    }
  } }));
});

router.get('/sandbox-timeout', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{% for i in range(0, 100000) %}{{ i }}{% endfor %}', { context: {}, config: { dev: true, security: { sandbox: true }, limits: { executionTimeout: 1 } } }));
});

router.get('/sandbox-context-modify', async (_req: Request, res: Response, next: NextFunction) => {
  // WHY: intentional mutation to test sandbox write-block — this callback attempts to reassign a property on the sandboxed context, which the sandbox proxy must reject.
  sendTemplateResult(res, next, await renderTemplate('{{ modifyContext() }}', { context: {
    modifyContext: () => {
      const context = createSandboxedContext({ context: { user: 'alice' }, sandboxEnabled: true });
      (context as { user?: string }).user = 'bob';
    }
  }, config: { dev: true, security: { sandbox: true } } }));
});

router.get('/blocked-context-keys', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ password }}', { context: { password: 'secret123' }, config: { dev: true, security: { strictMode: true, blockedContextKeys: ['password'] } } }));
});

router.get('/blocked-custom-key', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ creditCard }}', { context: { creditCard: '4111-1111-1111-1111' }, config: { dev: true, security: { strictMode: true, blockedContextKeys: ['creditCard'] } } }));
});

router.get('/no-blocked-context-keys', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ password.upper() }}', { context: { password: 'mySecretValue123', apiKey: 'abc-def-ghi' }, config: { dev: true } }));
});

router.get('/dangerous-context', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ env.NODE_ENV }}', { context: {}, config: { dev: true } }));
});

// WHY: intentional dangerous-context probe — injects globalThis into context so scanContextValues must flag it.
router.get('/dangerous-context-values', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.name }}', { context: { user: { name: 'test', eval: 'profile label' }, globalThis }, config: { dev: true, security: { strictMode: true, scanContextValues: true } } }));
});

router.get('/dangerous-template', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ eval("1+1") }}', { context: {}, config: { dev: true, security: { strictMode: true } } }));
});

router.get('/template-size', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('x'.repeat(10000), { context: {}, config: { dev: true, limits: { maxTemplateSize: 1000 } } }));
});

router.get('/invalid-config', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ test }}', { context: { test: 'value' }, config: { dev: true, limits: { executionTimeout: -1 } } }));
});

router.get('/key-not-found', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ missingKey }}', { context: {}, config: { dev: true, undefined: 'strict' } }));
});

router.get('/import-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/import-error.njk', { context: {}, config: { dev: true, undefined: 'strict', views: VIEWS } }));
});

router.get('/container-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ container.get("missing") }}', { context: { container: { get: undefined } }, config: { dev: true } }));
});

router.get('/reserved-keyword-filter', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ value }}', { context: { value: 'test' }, config: { dev: true, filters: { 'if': (v: unknown) => v } } }));
});

router.get('/reserved-keyword-global', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ myArray }}', { context: { myArray: [1, 2, 3] }, config: { dev: true, globals: { Array: {} } } }));
});

router.get('/groupby-type-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ items |> groupby("missing") }}', { context: { items: [{ name: 'test' }] }, config: { dev: true, undefined: 'strict' } }));
});

router.get('/sort-type-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ items |> sort("missing") }}', { context: { items: [{ name: 'test' }] }, config: { dev: true, undefined: 'strict' } }));
});

router.get('/dictsort-value-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ data |> dictsort }}', { context: { data: 'not an object' }, config: { dev: true } }));
});

router.get('/dictsort-by-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ data |> dictsort(false, "invalid") }}', { context: { data: { a: 1, b: 2 } }, config: { dev: true } }));
});

router.get('/unknown-block-runtime', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{% extends "base.njk" %}{% block nonexistent %}{{ super() }}{% endblock %}', { context: {}, config: { dev: true, views: VIEWS } }));
});

router.get('/expected-variable-end', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.name ', { context: { user: { name: 'test' } }, config: { dev: true } }));
});

router.get('/parser-unexpected-token', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{% if true %}{% endif %}{{ ', { context: {}, config: { dev: true } }));
});

// WHY: intentional sandbox probe — context exposes node's process via {{ global }} so the proxy must reject the lookup.
router.get('/sandbox-access', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ global }}', { context: { global: process }, config: { dev: true, security: { sandbox: true, contextStrict: false } } }));
});

router.get('/sandbox-allowlist', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ customVar }}', { context: { customVar: 'test' }, config: { dev: true, security: { sandbox: true, sandboxAllowlist: ['allowedVar'], sandboxMode: 'allowlist' } } }));
});

// WHY: intentional code-execution probe — injects setTimeout into context so the sandbox proxy must block calling it.
router.get('/sandbox-code-execution', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ setTimeout("alert(1)", 0) }}', { context: { setTimeout }, config: { dev: true, security: { sandbox: true } } }));
});

router.get('/sandbox-context-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ user.something }}', { context: { user: undefined }, config: { dev: true, security: { sandbox: true }, undefined: 'strict' } }));
});

router.get('/container-factory', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ container.get("test") }}', { context: { container: { get: 'not a function' } }, config: { dev: true } }));
});

router.get('/container-not-registered', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ myContainer.get("test") }}', { context: {}, config: { dev: true } }));
});

router.get('/template-must-be-string', async (_req: Request, res: Response, next: NextFunction) => {
    const invalidResult = createTemplateSource(123);
    if (!invalidResult.ok) {
      return next(invalidResult.error);
    }
    sendTemplateResult(res, next, await renderTemplate(invalidResult.value, { context: {}, config: { dev: true } }));
  });

router.get('/template-null', async (_req: Request, res: Response, next: NextFunction) => {
    const invalidResult = createTemplateSource(null);
    if (!invalidResult.ok) {
      return next(invalidResult.error);
    }
    sendTemplateResult(res, next, await renderTemplate(invalidResult.value, { context: {}, config: { dev: true } }));
  });

router.get('/undefined-value-match', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('{{ product.name }}', { context: { product: { test: 'test' } }, config: { dev: true, undefined: 'strict' } }));
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult(res, next, await renderTemplate('errors/index.njk', { context: { groups: errorGroups, total: errorGroups.reduce((sum, group) => sum + group.items.length, 0) }, config: { dev: true, views: VIEWS } }));
});

export { router as errorRouter };

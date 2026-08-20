import { isKeyedObject } from '@nunjucks/lib';
import { createSandboxedContext } from '@nunjucks/runtime';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { errorRoutes } from '../lib/domain/error-route-data.ts';
import { errorGroups } from '../lib/domain/error-route-metadata.ts';
import type { EnrichedFilterError } from '../lib/domain/error-route-types.ts';
import { renderTemplate } from '../lib/domain/render-template.ts';
import { sendTemplateResult } from '../lib/io/send-template-result.ts';
import { devErrorRouteConfig, strictErrorRouteConfig, VIEWS } from '../lib/io/views-path.ts';

/**
 * Error-catalog router — mounts one intentionally-failing route per engine boundary,
 * data-driven from `errorRoutes` plus inline-template, sandbox, and security probes,
 * so the central error middleware renders each rich diagnostic page.
 */
const router: Router = express.Router();

// WHY: imperative route registration — each error route mounts a GET handler under its own
// path. Loop exemption: static route list; no dynamic fan-out, no GC pressure.
for (const { path: routePath, template, context } of errorRoutes) {
  router.get(`/${routePath}`, async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult({
      res,
      next,
      result: await renderTemplate(template, { context, config: strictErrorRouteConfig }),
    });
  });
}

// WHY: filter-error lives here instead of error-route-data.ts because it needs a THROWING
// filter — the shell owns the throwing filters; the domain only owns the template + context
// data. Registering it solely here (no data-driven twin) keeps Express dispatch unambiguous.
router.get('/filter-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/filter-error.njk', {
      context: { value: 42, data: { user: 'alice' } },
      config: {
        dev: true,
        undefined: 'strict',
        views: VIEWS,
        filters: {
          failingAsync: () => {
            throw new Error('Filter intentionally failed');
          },
        },
      },
    }),
  });
});

router.get('/inline-filter-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ "test" |> nonexistentFilter }}', {
      context: {},
      config: { dev: true },
    }),
  });
});

router.get('/inline-syntax-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{% if true %} {% endif %} {{ invalid', {
      context: {},
      config: { dev: true },
    }),
  });
});

router.get('/undefined-block', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/undefined-block.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/no-super-block', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{% block content %}{{ super() }}{% endblock %}', {
      context: {},
      config: { dev: true },
    }),
  });
});

router.get('/reserved-keyword', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ super() }}', { context: {}, config: { dev: true } }),
  });
});

router.get('/no-super-block-template', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/no-super-block.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/invalid-include', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/invalid-include.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/circular-include', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/circular-include.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/file-not-found', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/file-not-found.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/filesystem-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/filesystem-error.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/inline-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ undefinedVar }}', {
      context: {},
      config: { dev: true, undefined: 'strict' },
    }),
  });
});

router.get('/sandbox-proto', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ user.__proto__ }}', {
      context: { user: {} },
      config: { dev: true, security: { sandbox: true } },
    }),
  });
});

router.get('/sandbox-constructor', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ user.constructor }}', {
      context: { user: {} },
      config: { dev: true, security: { sandbox: true } },
    }),
  });
});

// WHY: intentional sandbox probe — hands node's process through the context so the sandbox proxy must reject {{ user.global }} access.
router.get('/sandbox-process', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ user.global }}', {
      context: { user: { global: process } },
      config: { dev: true, security: { sandbox: true, contextStrict: 'error' } },
    }),
  });
});

router.get('/slice-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ [1,2,3][::0] }}', { context: {}, config: { dev: true } }),
  });
});

// WHY: shell-owned throwing filter — the engine has no built-in `list` filter, so this route
// registers one whose failure carries the catalog's LIST_FILTER code, showing how a custom
// filter's typed error surfaces as a rich error page.
router.get('/list-filter-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ 42 |> list }}', {
      context: {},
      config: {
        dev: true,
        filters: {
          list: (value: unknown) => {
            throw Object.assign(new Error(`list: expected array, got ${typeof value}`), {
              code: 'LIST_FILTER',
              subject: 'list',
            });
          },
        },
      },
    }),
  });
});

router.get('/in-operator-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ key in value }}', {
      context: { key: 'test', value: 123 },
      config: { dev: true },
    }),
  });
});

router.get('/filter-throw', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ "test" |> throwingFilter }}', {
      context: {},
      config: {
        dev: true,
        filters: {
          throwingFilter: () => {
            const baseError = new Error('Filter intentionally threw');
            const enriched: EnrichedFilterError = Object.assign(
              new Error(`Filter throwingFilter threw: ${baseError.message}`),
              { code: 'FILTER_ERROR', subject: 'throwingFilter' }
            );
            throw enriched;
          },
        },
      },
    }),
  });
});

router.get('/sandbox-timeout', async (_req: Request, res: Response, next: NextFunction) => {
  // WHY: the workload comes from the context — the engine has no `range` global, so a large
  // literal array keeps the loop honest while the 1ms executionTimeout budget trips TIMEOUT.
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{% for index in indexes %}{{ index }}{% endfor %}', {
      context: { indexes: Array.from({ length: 100000 }, (_, index) => index) },
      config: { dev: true, security: { sandbox: true }, limits: { executionTimeout: 1 } },
    }),
  });
});

router.get('/sandbox-context-modify', async (_req: Request, res: Response, next: NextFunction) => {
  // WHY: intentional mutation to test sandbox write-block — this callback attempts to reassign a property on the sandboxed context, which the sandbox proxy must reject.
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ modifyContext() }}', {
      context: {
        modifyContext: () => {
          const context = createSandboxedContext({
            context: { user: 'alice' },
            sandboxEnabled: true,
          });
          if (isKeyedObject(context)) {
            context.user = 'bob';
          }
        },
      },
      config: { dev: true, security: { sandbox: true } },
    }),
  });
});

router.get('/blocked-context-keys', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ password }}', {
      context: { password: 'example-secret' },
      config: { dev: true, security: { strictMode: true, blockedContextKeys: ['password'] } },
    }),
  });
});

router.get('/blocked-custom-key', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ creditCard }}', {
      context: { creditCard: 'example-card-number' },
      config: { dev: true, security: { strictMode: true, blockedContextKeys: ['creditCard'] } },
    }),
  });
});

router.get('/no-blocked-context-keys', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ password.upper() }}', {
      context: { password: 'example-password-value', apiKey: 'example-api-key' },
      config: { dev: true },
    }),
  });
});

// WHY: intentional dangerous-context probe — `process` itself is a dangerous reference, so the
// scanner flags it at any nesting depth under strictMode. Distinct from /dangerous-context-values,
// which injects globalThis to exercise the same scan at the top level.
router.get('/dangerous-context', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ env.NODE_ENV }}', {
      context: { env: process },
      config: { dev: true, security: { strictMode: true, scanContextValues: true } },
    }),
  });
});

// WHY: intentional dangerous-context probe — injects globalThis into context so scanContextValues must flag it.
router.get(
  '/dangerous-context-values',
  async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult({
      res,
      next,
      result: await renderTemplate('{{ user.name }}', {
        context: { user: { name: 'test', eval: 'profile label' }, globalThis },
        config: { dev: true, security: { strictMode: true, scanContextValues: true } },
      }),
    });
  }
);

router.get('/dangerous-template', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ eval("1+1") }}', {
      context: {},
      config: { dev: true, security: { strictMode: true } },
    }),
  });
});

router.get('/template-size', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('x'.repeat(10000), {
      context: {},
      config: { dev: true, limits: { maxTemplateSize: 1000 } },
    }),
  });
});

router.get('/invalid-config', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ test }}', {
      context: { test: 'value' },
      config: { dev: true, limits: { executionTimeout: -1 } },
    }),
  });
});

router.get('/key-not-found', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ missingKey }}', {
      context: {},
      config: { dev: true, undefined: 'strict' },
    }),
  });
});

router.get('/import-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/import-error.njk', {
      context: {},
      config: strictErrorRouteConfig,
    }),
  });
});

router.get('/container-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ container.get("missing") }}', {
      context: { container: { get: undefined } },
      config: { dev: true },
    }),
  });
});

router.get('/reserved-keyword-filter', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ value }}', {
      context: { value: 'test' },
      config: { dev: true, filters: { if: (v: unknown) => v } },
    }),
  });
});

router.get('/reserved-keyword-global', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ myArray }}', {
      context: { myArray: [1, 2, 3] },
      config: { dev: true, globals: { Array: {} } },
    }),
  });
});

router.get('/groupby-type-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ items |> groupby("missing") }}', {
      context: { items: [{ name: 'test' }] },
      config: { dev: true, undefined: 'strict' },
    }),
  });
});

router.get('/sort-type-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ items |> sort("missing") }}', {
      context: { items: [{ name: 'test' }] },
      config: { dev: true, undefined: 'strict' },
    }),
  });
});

router.get('/unknown-block-runtime', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate(
      '{% extends "base.njk" %}{% block nonexistent %}{{ super() }}{% endblock %}',
      { context: {}, config: devErrorRouteConfig }
    ),
  });
});

router.get('/expected-variable-end', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ user.name ', {
      context: { user: { name: 'test' } },
      config: { dev: true },
    }),
  });
});

router.get('/parser-unexpected-token', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{% if true %}{% endif %}{{ ', {
      context: {},
      config: { dev: true },
    }),
  });
});

// WHY: intentional sandbox probe — context exposes node's process via {{ global }} so the proxy must reject the lookup.
router.get('/sandbox-access', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ global }}', {
      context: { global: process },
      config: { dev: true, security: { sandbox: true, contextStrict: false } },
    }),
  });
});

router.get('/sandbox-allowlist', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ customVar }}', {
      context: { customVar: 'test' },
      config: {
        dev: true,
        security: { sandbox: true, sandboxAllowlist: ['allowedVar'], sandboxMode: 'allowlist' },
      },
    }),
  });
});

// WHY: intentional code-execution probe — injects setTimeout into context so the sandbox proxy must block calling it.
router.get('/sandbox-code-execution', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ setTimeout("alert(1)", 0) }}', {
      context: { setTimeout },
      config: { dev: true, security: { sandbox: true } },
    }),
  });
});

router.get('/sandbox-context-error', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ user.something }}', {
      context: { user: undefined },
      config: { dev: true, security: { sandbox: true }, undefined: 'strict' },
    }),
  });
});

router.get('/container-factory', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ container.get("test") }}', {
      context: { container: { get: 'not a function' } },
      config: { dev: true },
    }),
  });
});

router.get(
  '/container-not-registered',
  async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult({
      res,
      next,
      result: await renderTemplate('{{ myContainer.get("test") }}', {
        context: {},
        config: { dev: true },
      }),
    });
  }
);

// WHY: the render boundary itself validates template sources — this route feeds a
// non-string through the string-typed parameter on purpose to surface the engine's
// real TEMPLATE_MUST_BE_STRING catalog error with a stack-true location, instead of
// a hand-fabricated Error pointing at route plumbing. The unsafe widening is
// confined to this single named, greppable boundary probe.
const toInvalidTemplateSource = (source: unknown): string => source as string;

router.get('/template-must-be-string', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate(toInvalidTemplateSource(123), {
      context: {},
      config: { dev: true },
    }),
  });
});

router.get('/template-null', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate(toInvalidTemplateSource(null), {
      context: {},
      config: { dev: true },
    }),
  });
});

router.get('/undefined-value-match', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('{{ product.name }}', {
      context: { product: { test: 'test' } },
      config: { dev: true, undefined: 'strict' },
    }),
  });
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  sendTemplateResult({
    res,
    next,
    result: await renderTemplate('errors/index.njk', {
      context: {
        groups: errorGroups,
        total: errorGroups.reduce((sum, group) => sum + group.items.length, 0),
      },
      config: devErrorRouteConfig,
    }),
  });
});

export { router as errorRouter };

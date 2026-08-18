import { randomBytes } from 'node:crypto';
import { formatError, type SourceFileReader } from '@nunjucks/core';
import { readProjectSource } from '@nunjucks/core/diagnostics';
import { sanitize } from '@nunjucks/filters/sanitize';
import {
  createEngine,
  type ExpressEngineConfig,
  PACKAGE_VERSION,
} from '@nunjucks/integrations/express';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { renderTemplate } from './lib/domain/render-template.ts';
import { currentYear } from './lib/io/clock.ts';
import { sendTemplateResult } from './lib/io/send-template-result.ts';
import { VIEWS } from './lib/io/views-path.ts';
import { boundaryRouter } from './routes/boundaries.ts';
import { demoRouter } from './routes/demo.ts';
import { errorRouter } from './routes/errors.ts';
import { remoteRouter } from './routes/remote.ts';
import { sandboxRouter } from './routes/sandbox.ts';
import { streamingRouter } from './routes/streaming.ts';
import { undefinedRouter } from './routes/undefined.ts';
import { warningsRouter } from './routes/warnings.ts';

/**
 * Builds the Express demo app — engine registration, route mounts, and the central
 * error middleware (ANSI console + dev-gated HTML error pages).
 *
 * @returns The configured Express instance, unlistened.
 */
const createApp = (): Express => {
  const app: Express = express();

  const engineConfig: ExpressEngineConfig = {
    dev: true,
    autoescape: true,
    // WHY: views must be baked into the config — renderTemplate() builds a standalone engine
    // that does not see Express's app.set('views'), so without this the template name is
    // compiled as an inline literal string instead of being resolved from disk.
    views: VIEWS,
    globals: {
      appName: 'Nunjucks Express Demo',
      getYear: () => currentYear(),
    },
    filters: {
      // WHY: sanitize is opt-in — it ships on the @nunjucks/filters/sanitize subpath so
      // the DOMPurify security shell stays out of the pure engine barrel.
      sanitize,
      shout: (value: string) => `${value.toUpperCase()}!!!`,
    },
  };

  app.set('views', VIEWS);
  app.engine('.njk', createEngine(engineConfig));
  app.set('view engine', 'njk');

  // WHY: baseline hardening for every response — the demo serves no external assets,
  // so nosniff + no-referrer cost nothing and dampen content-type confusion and
  // referrer leakage if this app is ever copied onto a public host.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.render('index', { userName: 'Guest' });
  });

  app.get('/home', async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult({
      res,
      next,
      result: await renderTemplate('home-welcome.njk', {
        context: { username: 'John Doe' },
        config: engineConfig,
      }),
    });
  });

  app.get('/security', async (_req: Request, res: Response, next: NextFunction) => {
    sendTemplateResult({
      res,
      next,
      result: await renderTemplate('security-features.njk', {
        context: {
          userInput: '<script>alert("XSS")</script><p>Safe content</p>',
          configData: { theme: 'dark', debug: true },
          htmlContent: '<b>Bold</b> & "quoted"',
          attrContent: 'value="with quotes"',
        },
        config: engineConfig,
      }),
    });
  });

  app.use('/demo', demoRouter);
  app.use('/errors', errorRouter);
  app.use('/boundary', boundaryRouter);
  app.use('/remote', remoteRouter);
  app.use('/sandbox', sandboxRouter);
  app.use('/undefined', undefinedRouter);
  app.use('/warnings', warningsRouter);
  app.use(streamingRouter);

  // WHY: never ship rich dev error pages to prod clients
  const devErrorMode = process.env.NODE_ENV !== 'production';

  // WHY: renderContext can carry user PII and must never reach server logs — mirror the library's
  // redactForLog rule and strip it before the dev ANSI dump; only the (dev-gated) HTML page shows it.
  const stripRenderContext = (error: Error): Error => {
    if (!('renderContext' in error)) {
      return error;
    }
    const { renderContext: _redacted, ...propertyDescriptors } =
      Object.getOwnPropertyDescriptors(error);
    // WHY: descriptor rebuild instead of object spread — spread drops the non-enumerable Error
    // fields (message, stack), leaving the log formatter without err.message and crashing it.
    return Object.create(Object.getPrototypeOf(error), propertyDescriptors);
  };

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    // WHY: an error forwarded after headers are committed (mid-stream failure) cannot start
    // a new response — res.status().send() would throw ERR_HTTP_HEADERS_SENT; delegate to
    // Express's default handler instead, which terminates the socket safely.
    if (res.headersSent) {
      return next(err);
    }
    const sourceFileReader: SourceFileReader = readProjectSource;
    console.error(
      formatError(stripRenderContext(err), { format: 'ansi', dev: devErrorMode, sourceFileReader })
    );
    // WHY: the error document is fully self-contained (inline style + script, zero
    // external fetches), so it can run under the strictest CSP — nonce-gated
    // style/script, everything else denied. error-renderer threads the nonce onto
    // the emitted <style>/<script> tags; a per-response nonce keeps it unguessable.
    const nonce = randomBytes(16).toString('base64');
    res
      .status(500)
      .type('html')
      .set(
        'Content-Security-Policy',
        `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
      )
      .send(
        formatError(err, {
          format: 'html',
          dev: devErrorMode,
          sourceFileReader,
          version: PACKAGE_VERSION,
          csp: { nonce },
        })
      );
  });

  return app;
};

export { createApp };

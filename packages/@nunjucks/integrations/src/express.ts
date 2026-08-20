import path from 'node:path';
import type { NunjucksConfig, PerRenderOverrides } from '@nunjucks/core';
import { nunjucks, PACKAGE_VERSION } from '@nunjucks/core';
import { isOk, isPlainObject } from '@nunjucks/lib';

/**
 * Matches the view-engine callback signature Express passes to `app.engine(ext, fn)`.
 * `filePath` is the absolute template path resolved by Express's view system, while
 * `options` is the merged, untrusted locals bag; output and errors flow exclusively
 * through the Node-style `callback(err, rendered)` rather than a return value.
 */
type ExpressEngineFunction = (
  filePath: string,
  options: unknown,
  callback: (err: Error | null, rendered?: string) => void
) => void;

// WHY: Express merges app.locals/res.locals into the render-options bag and injects engine-internal keys
// (settings/cache/_locals). This is an untrusted boundary: the bag must be narrowed to a plain object and
// stripped of internal keys before it enters the engine as template context.
const EXPRESS_INTERNAL_OPTION_KEYS = new Set(['settings', 'cache', '_locals']);

const sanitizeExpressOptions = (options: unknown): Record<string, unknown> => {
  if (!isPlainObject(options)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => !EXPRESS_INTERNAL_OPTION_KEYS.has(key))
  );
};

// WHY: Express's `settings['view options']` convention (per-app defaults for the view
// engine, delivered inside the per-call options bag's `settings` key). Extracted BEFORE
// sanitization strips `settings`, and merged as DEFAULTS — per-call engine overrides
// (views/templatePath from the rendered file) win, matching Express's merge order.
type ViewOptionDefaults = Partial<
  Pick<PerRenderOverrides, 'executionTimeout' | 'streamContentType'>
>;

const readViewOptionDefaults = (options: unknown): ViewOptionDefaults => {
  if (!isPlainObject(options) || !isPlainObject(options.settings)) {
    return {};
  }
  const viewOptions = options.settings['view options'];
  if (!isPlainObject(viewOptions)) {
    return {};
  }
  return {
    ...(typeof viewOptions.executionTimeout === 'number' &&
    Number.isFinite(viewOptions.executionTimeout)
      ? { executionTimeout: viewOptions.executionTimeout }
      : {}),
    ...(viewOptions.streamContentType === 'html' ||
    viewOptions.streamContentType === 'json' ||
    viewOptions.streamContentType === 'text'
      ? { streamContentType: viewOptions.streamContentType }
      : {}),
  };
};

// WHY: createEngine closes over a nunjucks() factory instance built once at registration time (loader, filters,
// globals merged once). The returned Express view-engine function delegates each request to engine.render with
// two Express-specific per-call overrides — views (the file's directory) and templatePath (the full file path).
/**
 * Creates an Express view engine backed by a single `nunjucks()` instance —
 * config, loader, and custom filters/globals are baked in once at registration
 * time, not per request.
 *
 * @param config - Engine configuration (`NunjucksConfig`); the `views` root is
 *   overridden per call with the rendered file's directory.
 * @returns The Express view-engine function. Each call sanitizes Express's
 *   merged options bag (locals + engine-internal keys are stripped) into
 *   template context, applies `settings['view options']` as per-app default
 *   render overrides, then delegates to `engine.render` with the file's
 *   directory as `views` and its path as `templatePath`. All failures flow
 *   through the Express `callback(err)` channel — `Result` errors pass through
 *   as-is, unexpected rejections are wrapped in `Error` — so the function
 *   itself never throws.
 */
const createEngine = (config: NunjucksConfig = {}): ExpressEngineFunction => {
  const engine = nunjucks(config);
  return function nunjucksExpressEngine(
    filePath: string,
    options: unknown,
    callback: (err: Error | null, rendered?: string) => void
  ): void {
    const renderContext = sanitizeExpressOptions(options);
    const renderOptions = {
      ...readViewOptionDefaults(options),
      views: path.dirname(filePath),
      templatePath: filePath,
    };
    // WHY: Express mandates a sync-void engine signature — the async render runs in a
    // fire-and-forget IIFE so every outcome lands in `callback`, never as a floating
    // rejection.
    void (async () => {
      try {
        const result = await engine.render(path.basename(filePath), renderContext, renderOptions);
        if (isOk(result)) {
          callback(null, result.value);
        } else {
          callback(result.error);
        }
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  };
};

export type { ExpressEngineFunction, NunjucksConfig as ExpressEngineConfig };
export { createEngine, PACKAGE_VERSION };

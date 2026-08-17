import path from 'node:path';
import { nunjucks, PACKAGE_VERSION } from '@nunjucks/core';
import type { NunjucksConfig } from '@nunjucks/core';
import { isOk, isPlainObject } from '@nunjucks/lib';

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

// WHY: createEngine closes over a nunjucks() factory instance built once at registration time (loader, filters,
// globals merged once). The returned Express view-engine function delegates each request to engine.render with
// two Express-specific per-call overrides — views (the file's directory) and templatePath (the full file path).
const createEngine = (config: NunjucksConfig = {}): ExpressEngineFunction => {
  const engine = nunjucks(config);
  return function nunjucksExpressEngine(
    filePath: string,
    options: unknown,
    callback: (err: Error | null, rendered?: string) => void
  ): void {
    const renderContext = sanitizeExpressOptions(options);
    const renderOptions = { views: path.dirname(filePath), templatePath: filePath };
    engine
      .render(path.basename(filePath), renderContext, renderOptions)
      .then((result) => {
        if (isOk(result)) {
          callback(null, result.value);
        } else {
          callback(result.error);
        }
      })
      .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err))));
  };
};

export { createEngine, PACKAGE_VERSION };
export type { ExpressEngineFunction };
export type { NunjucksConfig as ExpressEngineConfig };

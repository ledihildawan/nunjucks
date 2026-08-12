import path from 'node:path';
import { nunjucks } from '@nunjucks/core';
import type { NunjucksConfig } from '@nunjucks/core';
import { isOk } from '@nunjucks/lib';

type ExpressEngineFunction = (
  filePath: string,
  options: object,
  callback: (err: Error | null, rendered?: string) => void
) => void;

// WHY: createEngine closes over a nunjucks() factory instance built once at registration time (loader, filters,
// globals merged once). The returned Express view-engine function delegates each request to engine.render with
// two Express-specific per-call overrides — views (the file's directory) and templatePath (the full file path).
const createEngine = (config: NunjucksConfig = {}): ExpressEngineFunction => {
  const engine = nunjucks(config);
  return function nunjucksExpressEngine(
    filePath: string,
    options: object,
    callback: (err: Error | null, rendered?: string) => void
  ): void {
    engine.render(path.basename(filePath), options as Record<string, unknown>, { views: path.dirname(filePath), templatePath: filePath })
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

export { createEngine };
export type { ExpressEngineFunction };
export type { NunjucksConfig as ExpressEngineConfig };

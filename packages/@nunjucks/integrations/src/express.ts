import path from 'node:path';
import { render } from '@nunjucks/core';
import { isOk } from '@nunjucks/shared';
import type { GlobalConfig } from '@nunjucks/core';

type ExpressEngineConfig = Partial<GlobalConfig>;

type ExpressEngineFunction = (
  filePath: string,
  options: Record<string, unknown>,
  callback: (err: Error | null, rendered?: string) => void
) => void;

const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction =>
  function nunjucksExpressEngine(
    filePath: string,
    options: Record<string, unknown>,
    callback: (err: Error | null, rendered?: string) => void
  ): void {
    render(path.basename(filePath), {
      context: options,
      ...config,
      views: path.dirname(filePath),
      templatePath: filePath,
    }).then((result) => {
      if (isOk(result)) {
        callback(null, result.value);
      } else {
        callback(result.error);
      }
    });
  };

export { createEngine };
export type { ExpressEngineConfig, ExpressEngineFunction };

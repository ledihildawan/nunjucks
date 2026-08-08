import path from 'node:path';
import { render } from '@nunjucks/core';
import type { GlobalConfig } from '@nunjucks/core';

type ExpressEngineConfig = Partial<GlobalConfig>;

type ExpressEngineFunction = (
  filePath: string,
  options: object,
  callback: (err: Error | null, rendered?: string) => void
) => void;

const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction =>
  function nunjucksExpressEngine(
    filePath: string,
    options: object,
    callback: (err: Error | null, rendered?: string) => void
  ): void {
    render(path.basename(filePath), options as Record<string, unknown>, {
      ...config,
      views: path.dirname(filePath),
      templatePath: filePath,
    }).then(
      (rendered) => callback(null, rendered),
      (err: Error) => callback(err),
    );
  };

export { createEngine };
export type { ExpressEngineConfig, ExpressEngineFunction };

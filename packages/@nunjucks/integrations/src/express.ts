import path from 'node:path';
import { render } from '@nunjucks/core';
import type { GlobalConfig } from '@nunjucks/core';

type ExpressEngineConfig = Partial<GlobalConfig>;

type ExpressEngineFunction = (filePath: string, options: Record<string, unknown>) => Promise<string>;

const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction =>
  async function nunjucksExpressEngine(
    filePath: string,
    options: Record<string, unknown>
  ): Promise<string> {
    return render(path.basename(filePath), options, {
      ...config,
      views: path.dirname(filePath),
      templatePath: filePath,
    });
  };

export { createEngine };
export type { ExpressEngineConfig, ExpressEngineFunction };

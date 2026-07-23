import path from 'node:path';
import { readFile } from 'node:fs/promises';
import EventEmitter from 'node:events';
import { renderWithEnv } from '../core/render.js';
import { createFileSystemLoader } from '../loaders/index.js';
import { createTemplate } from '../template/index.js';
import { createEnv, type Env } from '../core/env.js';
import { getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

export interface ExpressEngineConfig {
  dev?: boolean;
}

type ExpressEngineCallback = (err: Error | null, html?: string) => void;

type ExpressEngineFunction = (filePath: string, options: Record<string, unknown>, callback: ExpressEngineCallback) => void;

export const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction => {
  return function nunjucksExpressEngine(filePath: string, options: Record<string, unknown>, callback: ExpressEngineCallback): void {
    const viewsPath = path.dirname(filePath);
    const loader = createFileSystemLoader(viewsPath, { noCache: config.dev || false });

    const emitter = new EventEmitter();

    const env = createEnv({
      opts: { dev: config.dev || false, autoescape: true },
      globals: {},
      emitter,
      async getTemplate(name: string, eagerCompile?: boolean, includeChain?: unknown[] | null, ignoreMissing?: boolean) {
        const source = await loader.getSource(name);
        if (!source) {
          if (ignoreMissing) return null;
          throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
        }
        const template = createTemplate(source.src, this as unknown as Env, source.path, eagerCompile ?? true, includeChain);
        (template as { tmplStr?: string }).tmplStr = source.src;
        return template;
      }
    });

    const templateName = path.basename(filePath);
    const envWithPath = Object.create(env) as Record<string, unknown>;
    envWithPath.templatePath = filePath;
    renderWithEnv(templateName, env as Parameters<typeof renderWithEnv>[1], options as Record<string, unknown>, { ...config, templatePath: filePath })
      .then(html => callback(null, html))
      .catch(async (err: Error) => {
        if (!(err as { sourceContent?: string }).sourceContent && filePath) {
          try {
            (err as { sourceContent?: string }).sourceContent = await readFile(filePath, 'utf-8');
          } catch (e) {
            (err as { sourceReadError?: unknown }).sourceReadError = e;
          }
        }
        callback(err);
      });
  };
};

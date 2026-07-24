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

export interface ExpressEngineOptions {
  filePath: string;
  options: Record<string, unknown>;
}

export type ExpressEngineFunction = (filePath: string, options: Record<string, unknown>) => Promise<string>;

const renderTemplate = async (filePath: string, options: Record<string, unknown>, config: ExpressEngineConfig): Promise<string> => {
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
  try {
    const html = await renderWithEnv(templateName, env as Parameters<typeof renderWithEnv>[1], options, { ...config, templatePath: filePath });
    return html;
  } catch (err: unknown) {
    const errorWithMeta = err as Error & { sourceContent?: string; templatePath?: string; templateName?: string };
    if (!errorWithMeta.sourceContent && filePath) {
      try {
        errorWithMeta.sourceContent = await readFile(filePath, 'utf-8');
      } catch (e) {
        (err as { sourceReadError?: unknown }).sourceReadError = e;
      }
    }
    if (!errorWithMeta.templatePath) {
      errorWithMeta.templatePath = filePath;
    }
    if (!errorWithMeta.templateName) {
      errorWithMeta.templateName = path.basename(filePath);
    }
    throw err;
  }
};

export const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction => {
  return async function nunjucksExpressEngine(filePath: string, options: Record<string, unknown>): Promise<string> {
    return renderTemplate(filePath, options, config);
  };
};

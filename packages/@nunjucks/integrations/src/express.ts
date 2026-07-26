import path from 'node:path';
import { readFile } from 'node:fs/promises';
import EventEmitter from 'node:events';
import { renderWithEnv } from '@nunjucks/core/core/render';
import { createFileSystemLoader } from '@nunjucks/loaders';
import { createTemplate } from '@nunjucks/core/template';
import { createEnv, type Env } from '@nunjucks/core/env';
import { getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

interface ExpressEngineConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: 'default' | 'chainable' | 'strict' | 'debug';
  globals?: Record<string, unknown>;
  filters?: Record<string, (...args: unknown[]) => unknown>;
  extensions?: Record<string, unknown>;
  dompurify?: Record<string, unknown>;
}

interface ExpressEngineOptions {
  filePath: string;
  options: Record<string, unknown>;
}

type ExpressEngineFunction = (filePath: string, options: Record<string, unknown>) => Promise<string>;

const renderTemplate = async (
  filePath: string,
  options: Record<string, unknown>,
  config: ExpressEngineConfig
): Promise<string> => {
  const viewsPath = path.dirname(filePath);
  const loader = createFileSystemLoader(viewsPath, { noCache: config.dev });

  const emitter = new EventEmitter();

  const env = createEnv({
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default'
    },
    globals: config.globals ?? {},
    emitter,
    async getTemplate(name: string, eagerCompile?: boolean, includeChain?: unknown[] | null, ignoreMissing?: boolean) {
      const source = await loader.getSource(name);
      if (!source) {
        if (ignoreMissing) { return null; }
        throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
      }
      const template = createTemplate(source.src, this as unknown as Env, source.path, eagerCompile ?? true, includeChain);
      (template as { tmplStr?: string }).tmplStr = source.src;
      return template;
    }
  });

  const templateName = path.basename(filePath);

  const renderConfig: Record<string, unknown> = {
    dev: config.dev,
    autoescape: config.autoescape,
    undefined: config.undefined,
    globals: config.globals,
    filters: config.filters,
    extensions: config.extensions,
    templatePath: filePath,
    dompurify: config.dompurify,
  };

  try {
    const html = await renderWithEnv(templateName, env as Parameters<typeof renderWithEnv>[1], options, renderConfig);
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

const createEngine = (config: ExpressEngineConfig = {}): ExpressEngineFunction => async function nunjucksExpressEngine(
  filePath: string,
  options: Record<string, unknown>
): Promise<string> {
  return renderTemplate(filePath, options, config);
};

export { createEngine };
export type { ExpressEngineConfig, ExpressEngineOptions, ExpressEngineFunction };

import { getError } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import { isErr } from '@nunjucks/lib';
import type { TemplateLoader } from '@nunjucks/loaders';
import type { Env, GetTemplateOptions } from '@nunjucks/runtime';
import { createTemplate } from '../template/index.ts';
import type { RenderConfig } from './render-types.ts';

const createEnvLookups = (
  config: RenderConfig
): Pick<Env, 'getFilter' | 'getTest' | 'getExtension'> => ({
  getFilter: (name: string, lineno: number | null, colno: number | null) => {
    const filter = config.filters?.[name];
    if (filter) {
      return filter;
    }
    throw createLog('error', {
      def: getError('UNDEFINED_FILTER'),
      params: { name },
      subject: name,
      context: { lineno, colno, phase: 'render', lineBase: 'zero' },
    });
  },
  getTest: (name: string, lineno: number | null, colno: number | null) => {
    const test = config.tests?.[name];
    if (test) {
      return test;
    }
    throw createLog('error', {
      def: getError('UNDEFINED_TEST'),
      params: { name },
      subject: name,
      context: { lineno, colno, phase: 'render', lineBase: 'zero' },
    });
  },
  getExtension: (name: string) => {
    const extension = config.extensions?.[name];
    if (extension !== undefined) {
      return extension;
    }
    throw createLog('error', {
      def: getError('UNDEFINED_EXTENSION'),
      params: { name },
      subject: name,
      context: { phase: 'render', lineBase: 'zero' },
    });
  },
});

const buildRenderEnv = (loader: TemplateLoader | null, config: RenderConfig): Env | null => {
  if (!loader || config.env) {
    return null;
  }

  return {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    renderingTemplates: new Set(),
    ...createEnvLookups(config),
    async getTemplate(
      this: Env,
      { name, eagerCompile = true, includeChain, ignoreMissing }: GetTemplateOptions
    ) {
      const sourceResult = await loader.getSource(name);
      if (sourceResult === null) {
        if (ignoreMissing) {
          return null;
        }
        throw createLog('error', {
          def: getError('FILE_NOT_FOUND'),
          params: { path: name },
          subject: name,
          context: { phase: 'load' },
        });
      }
      if (isErr(sourceResult)) {
        throw sourceResult.error;
      }
      const source = sourceResult.value;
      return createTemplate({
        src: source.src,
        env: this,
        path: source.path,
        eagerCompile,
        includeChain,
      });
    },
  };
};

const buildExecutionEnv = (config: RenderConfig): Env =>
  config.env ?? {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    ...createEnvLookups(config),
    // WHY: an inline render (no views/loader) can still hit {% include %} — without
    // this fallback the emitted `env.getTemplate(...)` call surfaces a raw TypeError
    // instead of a catalogued miss. Mirrors template-source.ts createFallbackEnv.
    getTemplate({ name, ignoreMissing }: GetTemplateOptions) {
      if (ignoreMissing) {
        return null;
      }
      throw createLog('error', {
        def: getError('FILE_NOT_FOUND'),
        params: { path: name },
        subject: name,
        context: { phase: 'load' },
      });
    },
  };

export { buildExecutionEnv, buildRenderEnv, createEnvLookups };

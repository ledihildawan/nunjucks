import { getError } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import { isErr, type TemplateLoader } from '@nunjucks/lib';
import { loadCompiledCode, type Env, type GetTemplateOptions } from '@nunjucks/runtime';
import { isCompiledTemplateExports, type CompiledTemplateExports } from '@nunjucks/shared';
import { createTemplate } from '../template/index.ts';
import { buildCompileCacheKey } from '../template/template-cache.ts';
import type { CompiledCodeCache } from '../template/template-cache.ts';
import type { RenderConfig } from './render-types.ts';

/** Builds env lookups that resolve (or catalog-throw) filters, tests, and extensions. */
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

// WHY: loaded-exports memo for the include path — loadCompiledCode evals the compiled
// string (the expensive part); once evaluated for a key, the exports object is reused
// for every later include of the same source identity. Bounded by the code cache LRU:
// a key evicted from the code cache also stops being served here (the get() miss
// short-circuits), letting the memo entry be GC'd with it.
const createIncludeExportsMemo = () => {
  const memo = new Map<string, CompiledTemplateExports>();
  return {
    get: (cache: CompiledCodeCache, key: string): CompiledTemplateExports | null => {
      const code = cache.get(key);
      if (code === undefined) {
        return null;
      }
      const cached = memo.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const loaded = loadCompiledCode(code);
      if (!isCompiledTemplateExports(loaded)) {
        return null;
      }
      memo.set(key, loaded);
      return loaded;
    },
  };
};

/** Builds the include-capable env — loader-backed `getTemplate` with compiled reuse. */
const buildRenderEnv = (loader: TemplateLoader | null, config: RenderConfig): Env | null => {
  if (!loader || config.env) {
    return null;
  }

  const includeExportsMemo = createIncludeExportsMemo();

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
      // WHY: include-path compiled-code reuse — the compiled rootRenderFunc is pure
      // generated code with NO env identity baked in (env arrives as an argument at
      // every call), so the SAME loaded exports can be re-wrapped into a fresh
      // Template bound to THIS render's env. Re-wrapping keeps per-render env
      // isolation (filters/tests/extension lookups stay render-local) while skipping
      // parse+codegen+eval for repeated includes. The memo is keyed by the same
      // source-identity key as the code cache, so freshness is inherited; the first
      // include primes the code-cache entry through the normal compile path.
      const cache = config.compiledCodeCache;
      const compiledExports =
        cache && source.path
          ? includeExportsMemo.get(
              cache,
              buildCompileCacheKey({
                templatePath: source.path,
                templateName: name,
                source: source.src,
                config,
              })
            )
          : null;
      if (compiledExports) {
        return createTemplate({
          src: source.src,
          env: this,
          path: source.path,
          eagerCompile: false,
          includeChain,
          compiledExports,
        });
      }
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

/** Resolves the execution env — the caller's own, or a fresh one with load-error `getTemplate`. */
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

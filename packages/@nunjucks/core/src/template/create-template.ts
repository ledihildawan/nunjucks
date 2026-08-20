import type { IncludeChain } from '@nunjucks/error-formatter';
import { normalizeErrorMetadata, prettifyError } from '@nunjucks/error-formatter';
import type { Env } from '@nunjucks/runtime';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import { extractCompiledBlocks } from './compiled-blocks.ts';
import { createTemplateCompiler } from './template-compiler';
import { createTemplateErrorHandler } from './template-error-handler';
import { createGetExported } from './template-exporter';
import { createTemplateRenderer } from './template-renderer';
import { initTemplateState, loadSource } from './template-source';
import type { TemplateObject, TemplateSource, TemplateState } from './types';
import { Template } from './types';

// WHY: adopts pre-computed compiled exports into the template state machine — the
// same 'compiled' shape commit() produces, minus the eval (the exports object was
// already loaded by the include-path cache). Block/meta extraction is shared with
// template-compiler so downstream consumers are shape-identical.
const adoptCompiledExports = (
  state: TemplateState,
  compiledExports: CompiledTemplateExports
): TemplateState => ({
  ...state,
  status: 'compiled',
  tmplStr: null,
  tmplProps: compiledExports,
  ...extractCompiledBlocks(compiledExports),
  rootRenderFunc: compiledExports.root,
});

/** Inputs to `createTemplate` — source string/object, env, path, and compile flags. */
interface CreateTemplateOptions {
  src: string | TemplateSource;
  env?: Env;
  path?: string | null;
  eagerCompile?: boolean;
  includeChain?: IncludeChain | null;
  // WHY: pre-computed compiled exports (include-path cache reuse) — skips parse+
  // codegen+eval entirely; the state machine starts directly at 'compiled'. The
  // exports are pure generated code with no host identity, safe to share across
  // Templates bound to different envs.
  compiledExports?: CompiledTemplateExports;
}

/**
 * Creates a stateful `TemplateObject` — a `source`→`compiled` state machine
 * wired to its own compiler, renderer, and error handler, with optional
 * eager compile and pre-computed export adoption for include-path reuse.
 */
export const createTemplate = ({
  src,
  env,
  path,
  eagerCompile,
  includeChain,
  compiledExports,
}: CreateTemplateOptions): TemplateObject => {
  let currentState: TemplateState = loadSource(
    initTemplateState({ src, env, path, includeChain }),
    src
  );
  if (compiledExports) {
    currentState = adoptCompiledExports(currentState, compiledExports);
  }

  const getState = (): TemplateState => currentState;
  const commit = (next: TemplateState): void => {
    currentState = next;
  };

  const errorHandler = createTemplateErrorHandler(getState);
  const compiler = createTemplateCompiler({ getState, commit });
  const renderer = createTemplateRenderer({ getState, compiler, errorHandler });

  if (eagerCompile) {
    try {
      compiler.compile();
    } catch (err: unknown) {
      throw prettifyError({
        path: currentState.path,
        withInternals: currentState.env.opts.dev,
        err: normalizeErrorMetadata(err).error,
      });
    }
  }

  const template: TemplateObject = {
    [Template]: true,
    get env() {
      return currentState.env;
    },
    get path() {
      return currentState.path;
    },
    get compiled() {
      return currentState.status === 'compiled';
    },
    get blocks() {
      return currentState.blocks;
    },
    get blockMeta() {
      return currentState.blockMeta;
    },
    get rootRenderFunc() {
      return currentState.rootRenderFunc;
    },
    render: renderer.render,
    compile: () => compiler.compile(),
    getExported: createGetExported(getState, compiler),
  };

  return template;
};

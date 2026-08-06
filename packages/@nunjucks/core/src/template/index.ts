import { prettifyError } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import type { Env } from '@nunjucks/runtime';
import type { TemplateObject, TemplateSource } from './types';
import { Template } from './types';
import { createTemplateErrorHandler } from './error-helpers';
import { createTemplateCompiler } from './template-compiler';
import { createTemplateRenderer } from './renderer-helpers';
import { initTemplateState, loadSource } from './source-helpers';
import { createGetExported } from './export-helpers';

export { Template };

export const createTemplate = (src: string | TemplateSource, env?: Env, path?: string | null, eagerCompile?: boolean, includeChain?: IncludeChain | null): TemplateObject => {
  const state = initTemplateState(src, env, path, includeChain);
  loadSource(state, src);

  const errorHandler = createTemplateErrorHandler(state);
  state.compiler = createTemplateCompiler(state);
  const renderer = createTemplateRenderer(state, errorHandler);

  if (eagerCompile) {
    try {
      state.compiler.compile();
    } catch (err) {
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: err as Error });
    }
  }

  const template: TemplateObject = {
    [Template]: true,
    get env() { return state.env; },
    get path() { return state.path; },
    get compiled() { return state.compiled; },
    get blocks() { return state.blocks; },
    get blockMeta() { return state.blockMeta; },
    get rootRenderFunc() { return state.rootRenderFunc; },
    render: renderer.render,
    compile: () => state.compiler?.compile(),
    getExported: createGetExported(state),
  };

  return template;
};

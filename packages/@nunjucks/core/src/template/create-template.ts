import { prettifyError } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import type { Env } from '@nunjucks/runtime';
import type { TemplateObject, TemplateSource, TemplateState } from './types';
import { Template } from './types';
import { createTemplateErrorHandler } from './template-error-handler';
import { createTemplateCompiler } from './template-compiler';
import { createTemplateRenderer } from './template-renderer';
import { initTemplateState, loadSource } from './template-source';
import { createGetExported } from './template-exporter';

interface CreateTemplateOptions {
  src: string | TemplateSource;
  env?: Env;
  path?: string | null;
  eagerCompile?: boolean;
  includeChain?: IncludeChain | null;
}

export const createTemplate = ({ src, env, path, eagerCompile, includeChain }: CreateTemplateOptions): TemplateObject => {
  let currentState: TemplateState = loadSource(initTemplateState({ src, env, path, includeChain }), src);

  const getState = (): TemplateState => currentState;
  const commit = (next: TemplateState): void => { currentState = next; };

  const errorHandler = createTemplateErrorHandler(getState);
  const compiler = createTemplateCompiler({ getState, commit });
  const renderer = createTemplateRenderer(getState, compiler, errorHandler);

  if (eagerCompile) {
    try {
      compiler.compile();
    } catch (err) {
      throw prettifyError({ path: currentState.path, withInternals: currentState.env.opts.dev, err: err as Error });
    }
  }

  const template: TemplateObject = {
    [Template]: true,
    get env() { return currentState.env; },
    get path() { return currentState.path; },
    get compiled() { return currentState.status === 'compiled'; },
    get blocks() { return currentState.blocks; },
    get blockMeta() { return currentState.blockMeta; },
    get rootRenderFunc() { return currentState.rootRenderFunc; },
    render: renderer.render,
    compile: () => compiler.compile(),
    getExported: createGetExported(getState, compiler),
  };

  return template;
};
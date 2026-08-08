import type { ParseOptions } from '@nunjucks/parser';
import type { UndefinedMode, BlockLocation } from '@nunjucks/runtime';
import { HOOK_EVENTS, loadCompiledCode } from '@nunjucks/runtime';
import { extractBlocks, isCompiledTemplateExports, BLOCK_META_KEY, isErr } from '@nunjucks/shared';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import { prettifyError } from '@nunjucks/log';
import { compileToCode } from '../compile-pipeline.ts';
import type { TemplateState } from './types';

export { createTemplateCompiler };

interface TemplateStateCell {
  getState: () => TemplateState;
  commit: (next: TemplateState) => void;
}

const createTemplateCompiler = ({ getState, commit }: TemplateStateCell) => {
  const compileToProps = (state: TemplateState): CompiledTemplateExports | null => {
    if (state.tmplProps) {
      return state.tmplProps;
    }
    const codeResult = compileToCode({ source: state.tmplStr ?? '', templateName: state.path ?? '', undefinedMode: state.env.opts.undefined as UndefinedMode | undefined, parseOpts: state.env.opts as ParseOptions });
    // WHY: compileToCode returns Result, but this template-include path feeds safeCompile which prettifies+rethrows for the include system; unwrapping here keeps that throw-based shell intact while the render() path uses Result end-to-end.
    if (isErr(codeResult)) { throw codeResult.error; }
    const compiled = loadCompiledCode(codeResult.value);
    if (!isCompiledTemplateExports(compiled)) {
      return null;
    }
    return compiled;
  };

  const compile = () => {
    const state = getState();
    const startTime = Date.now();
    state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      const props = compileToProps(state);
      commit({
        ...state,
        blocks: extractBlocks(props ?? {}) as Record<string, (...args: unknown[]) => unknown>,
        blockMeta: (props?.[BLOCK_META_KEY] as Record<string, BlockLocation>) ?? {},
        rootRenderFunc: props?.root as TemplateState['rootRenderFunc'],
        compiled: true,
      });

      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, { template: state, path: state.path, duration: Date.now() - startTime });
    } catch (error) {
      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, { template: state, path: state.path, error, duration: Date.now() - startTime });
      throw error;
    }
  };

  const safeCompile = async () => {
    try {
      compile();
    } catch (e) {
      throw prettifyError({ path: getState().path, withInternals: getState().env.opts.dev, err: e as Error });
    }
  };

  return { compile, safeCompile };
};

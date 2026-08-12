import type { ParseOptions } from '@nunjucks/parser';
import type { UndefinedMode, BlockLocation } from '@nunjucks/runtime';
import { HOOK_EVENTS, loadCompiledCode } from '@nunjucks/runtime';
import { extractBlocks, isCompiledTemplateExports, BLOCK_META_KEY, type CompiledTemplateExports } from '@nunjucks/compiler';
import { isErr, ok, err, type Result } from '@nunjucks/lib';
import { prettifyError } from '@nunjucks/error-formatter';
import { compileToCode } from '../compile-pipeline.ts';
import type { TemplateState } from './types';

export { createTemplateCompiler };

interface TemplateStateCell {
  getState: () => TemplateState;
  commit: (next: TemplateState) => void;
}

const createTemplateCompiler = ({ getState, commit }: TemplateStateCell) => {
  const compileToProps = (state: TemplateState): Result<CompiledTemplateExports, Error> => {
    if (state.status === 'compiled') {
      return ok(state.tmplProps);
    }
    const codeResult = compileToCode({ source: state.tmplStr, templateName: state.path ?? '', undefinedMode: state.env.opts.undefined as UndefinedMode | undefined, parseOpts: state.env.opts as ParseOptions });
    if (isErr(codeResult)) { return err(codeResult.error); }
    const compiled = loadCompiledCode(codeResult.value);
    if (!isCompiledTemplateExports(compiled)) {
      return err(new Error('Compiled template output is missing a valid root export'));
    }
    return ok(compiled);
  };

  const compile = () => {
    const state = getState();
    // WHY: compile() is the imperative shell — it eval()s compiled code via loadCompiledCode, mutates state through commit(), and emits lifecycle hooks. Date.now() here provides shell-level compile-duration metrics consistent with that role; pure compileToCode() above has no clock access.
    const startTime = Date.now();
    state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      const propsResult = compileToProps(state);
      if (isErr(propsResult)) { throw propsResult.error; }
      const props = propsResult.value;
      commit({
        env: state.env,
        path: state.path,
        includeChain: state.includeChain,
        status: 'compiled',
        tmplStr: null,
        tmplProps: props,
        blocks: extractBlocks(props) as Record<string, (...args: unknown[]) => unknown>,
        blockMeta: (props[BLOCK_META_KEY] as Record<string, BlockLocation>) ?? {},
        rootRenderFunc: props.root,
      });

      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, { template: state, path: state.path, duration: Date.now() - startTime });
    } catch (error: unknown) {
      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, { template: state, path: state.path, error, duration: Date.now() - startTime });
      throw error;
    }
  };

  const safeCompile = async () => {
    try {
      compile();
    } catch (e: unknown) {
      throw prettifyError({ path: getState().path, withInternals: getState().env.opts.dev, err: e as Error });
    }
  };

  return { compile, safeCompile };
};

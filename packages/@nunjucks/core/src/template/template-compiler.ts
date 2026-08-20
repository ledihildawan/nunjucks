import { getError } from '@nunjucks/error-catalog';
import { createLog, normalizeErrorMetadata, prettifyError } from '@nunjucks/error-formatter';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import type { ParseOptions } from '@nunjucks/parser';
import { HOOK_EVENTS, loadCompiledCode } from '@nunjucks/runtime';
import { type CompiledTemplateExports, isCompiledTemplateExports } from '@nunjucks/shared';
import { compileToCode } from '../compile-pipeline.ts';
import { extractCompiledBlocks } from './compiled-blocks.ts';
import type { TemplateState } from './types.ts';

export { createTemplateCompiler };

interface TemplateStateCell {
  getState: () => TemplateState;
  commit: (next: TemplateState) => void;
}

/**
 * Creates the template compiler — compiles on demand, commits the resulting
 * state, and emits start/complete/error lifecycle hooks around the eval.
 */
const createTemplateCompiler = ({ getState, commit }: TemplateStateCell) => {
  const compileToProps = (state: TemplateState): Result<CompiledTemplateExports, Error> => {
    if (state.status === 'compiled') {
      return ok(state.tmplProps);
    }
    const codeResult = compileToCode({
      source: state.tmplStr,
      templateName: state.path ?? '',
      // WHY: no cast — Env.opts.undefined is statically UndefinedMode (runtime's Env
      // contract) and compileToCode accepts UndefinedMode | undefined.
      undefinedMode: state.env.opts.undefined,
      // WHY: cast rides on the upstream validation guarantee — every Env reaching the
      // state machine is built by render-env.ts from a RenderConfig already narrowed by
      // validateConfig (factory) / validateRender, so opts fields consumed by ParseOptions
      // (autoescape) are well-typed; absent lexer fields fall back to parser defaults.
      parseOpts: state.env.opts as ParseOptions,
    });
    if (isErr(codeResult)) {
      return err(codeResult.error);
    }
    const compiled = loadCompiledCode(codeResult.value);
    if (!isCompiledTemplateExports(compiled)) {
      // WHY: catalog-enriched (INVALID_CODE_FORMAT) — a compiled output without a root export means the
      // code-loader eval'd something that is not a nunjucks-compiled template.
      return err(
        createLog('error', {
          def: {
            ...getError('INVALID_CODE_FORMAT'),
            message: () => 'Compiled template output is missing a valid root export',
          },
          params: {},
          subject: state.path ?? null,
          context: { phase: 'compile' },
        })
      );
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
      if (isErr(propsResult)) {
        throw propsResult.error;
      }
      const props = propsResult.value;
      commit({
        env: state.env,
        path: state.path,
        includeChain: state.includeChain,
        status: 'compiled',
        tmplStr: null,
        tmplProps: props,
        ...extractCompiledBlocks(props),
        rootRenderFunc: props.root,
      });

      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, {
        template: state,
        path: state.path,
        duration: Date.now() - startTime,
      });
    } catch (error: unknown) {
      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, {
        template: state,
        path: state.path,
        error,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  };

  const safeCompile = async () => {
    try {
      compile();
    } catch (compileErr: unknown) {
      throw prettifyError({
        path: getState().path,
        withInternals: getState().env.opts.dev,
        err: normalizeErrorMetadata(compileErr).error,
      });
    }
  };

  return { compile, safeCompile };
};

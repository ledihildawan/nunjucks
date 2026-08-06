import type { ParseOptions } from '@nunjucks/parser';
import type { UndefinedMode, BlockLocation } from '@nunjucks/runtime';
import { HOOK_EVENTS } from '@nunjucks/runtime';
import { extractBlocks, BLOCK_META_KEY } from '@nunjucks/shared';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import { prettifyError } from '@nunjucks/log';
import { compileToCode } from '../compile-pipeline.ts';
import type { TemplateState } from './types';

export { createTemplateCompiler };

const createTemplateCompiler = (state: TemplateState) => {
  const compile = () => {
    const startTime = Date.now();
    state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      const compileToProps = (): CompiledTemplateExports | null => {
        if (state.tmplProps) {
          return state.tmplProps;
        }
        const code = compileToCode(state.tmplStr || '', state.path || '', state.env.opts.undefined as UndefinedMode | undefined, state.env.opts as ParseOptions);
        return new Function(code)() as CompiledTemplateExports | null;
      };
      const props: CompiledTemplateExports | null = compileToProps();

      state.blocks = extractBlocks(props ?? {}) as Record<string, (...args: unknown[]) => unknown>;
      state.blockMeta = ((props?.[BLOCK_META_KEY] as Record<string, BlockLocation>) || {});
      state.rootRenderFunc = props?.root as typeof state.rootRenderFunc;
      state.compiled = true;

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
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error });
    }
  };

  return { compile, safeCompile };
};

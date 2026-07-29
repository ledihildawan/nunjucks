import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import type { UndefinedMode } from '@nunjucks/runtime';
import { transform } from '@nunjucks/transformers';
import { extractBlocks } from '@nunjucks/shared';
import { HOOK_EVENTS } from '@nunjucks/runtime/hooks';
import type { TemplateState } from './types';

export { createTemplateCompiler };

const createTemplateCompiler = (state: TemplateState) => {
  const compile = () => {
    const startTime = Date.now();
    state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      const compileToProps = (): Record<string, unknown> | null => {
        if (state.tmplProps) {
          return state.tmplProps;
        }
        const c = createCompiler(state.path || '', state.env.opts.undefined as UndefinedMode | undefined, state.tmplStr || '');
        const ast = parse(state.tmplStr || '', [], state.env.opts as ParseOptions);
        const transformedAst = transform(ast);
        c.compile(transformedAst);
        const code = c.getCode();
        return new Function(code)() as Record<string, unknown> | null;
      };
      const props: Record<string, unknown> | null = compileToProps();

      state.blocks = extractBlocks(props as Record<string, unknown>) as Record<string, (...args: unknown[]) => unknown>;
      state.blockMeta = (props?.__blockMeta || {}) as Record<string, unknown>;
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

import { prettifyError } from '@nunjucks/log';

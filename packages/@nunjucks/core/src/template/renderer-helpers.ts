import { createContext } from '@nunjucks/runtime/context';
import type { ContextEnv, BlockLocation } from '@nunjucks/runtime/context';
import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { injectWarningsScript } from '@nunjucks/log';
import type { Warning, IncludeChain } from '@nunjucks/log';
import { prettifyError, getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import type { TemplateState } from './types';
import { createRuntimeWithContext } from './runtime-helpers';

export { createTemplateRenderer, createRenderFrame };

const createRenderFrame = (parentFrame: unknown): Frame => {
  const frame = parentFrame ? (parentFrame as Pick<Frame, 'push'>).push(true) : createFrame();
  frame.topLevel = true;
  return frame;
};

const createTemplateRenderer = (state: TemplateState, errorHandler: { enrichError: (e: unknown) => unknown }) => {
  const { enrichError } = errorHandler;

  const wrapRenderError = (e: unknown): never => {
    throw prettifyError({
      path: (e as Record<string, unknown>).path as string || state.path,
      withInternals: state.env.opts.dev,
      err: enrichError(e as Record<string, unknown>) as unknown as Error,
      includeChain: ((e as Record<string, unknown>)._includeChain as IncludeChain | undefined) || (state._includeChain as unknown as IncludeChain | undefined)
    });
  };

  const render = async (ctx: unknown, parentFrame?: unknown) => {
    await state.compiler?.safeCompile();

    if (state.env._renderingTemplates.has(state.path)) {
      throw createLog('error', getError('CIRCULAR_INCLUDE'), { path: state.path as string }, state.path as string, { phase: 'render' });
    }

    state.env._renderingTemplates.add(state.path);

    const context = createContext(
      (ctx || {}) as Record<string, unknown>,
      state.blocks,
      state.env as unknown as ContextEnv,
      { blockLocations: state.blockMeta as Record<string, BlockLocation> }
    );
    const frame = createRenderFrame(parentFrame);

    try {
      const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
      const result = await state.rootRenderFunc?.(state.env, context, frame, runtime);
      if (runtime.__warnings__.length > 0 && state.env.opts.dev) {
        return result + injectWarningsScript(runtime.__warnings__ as Warning[], { dev: true, verbosity: 'medium' });
      }
      return result as string;
    } catch (e) {
      wrapRenderError(e);
    } finally {
      state.env._renderingTemplates.delete(state.path);
    }
  };

  return { render };
};

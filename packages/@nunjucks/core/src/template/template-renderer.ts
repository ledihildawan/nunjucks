import { createContext, createFrame, type BlockLocation, type Frame } from '@nunjucks/runtime';
import { injectWarningsScript } from '@nunjucks/log';
import type { Warning, IncludeChain } from '@nunjucks/log';
import { prettifyError, getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import type { TemplateState } from './types';
import type { ErrorWithLineInfo } from './template-error-handler';
import { createRuntimeWithContext } from './runtime-factory';

export { createTemplateRenderer, createRenderFrame };

const createRenderFrame = (parentFrame: Frame | undefined): Frame => {
  const frame = parentFrame ? parentFrame.push(true) : createFrame();
  frame.topLevel = true;
  return frame;
};

const createTemplateRenderer = (
  getState: () => TemplateState,
  compiler: { safeCompile: () => Promise<void> },
  errorHandler: { enrichError: (e: ErrorWithLineInfo) => Error },
) => {
  const { enrichError } = errorHandler;

  const wrapRenderError = (state: TemplateState, e: unknown): Error => prettifyError({
    path: (e as { path?: string }).path ?? state.path,
    withInternals: state.env.opts.dev,
    err: enrichError(e as ErrorWithLineInfo),
    includeChain: (e as { includeChain?: IncludeChain }).includeChain ?? state.includeChain ?? undefined
  });

  const render = async (ctx: Record<string, unknown>, parentFrame?: unknown): Promise<string> => {
    await compiler.safeCompile();
    const state = getState();

    const renderingTemplates = state.env.renderingTemplates;
    if (renderingTemplates?.has(state.path)) {
      throw createLog('error', { def: getError('CIRCULAR_INCLUDE'), params: { path: state.path as string }, subject: state.path as string, context: { phase: 'render' } });
    }

    renderingTemplates?.add(state.path);

    const context = createContext({
      ctx: ctx ?? {},
      blocks: state.blocks,
      env: state.env,
      metadata: { blockLocations: state.blockMeta as Record<string, BlockLocation> },
    });
    const frame = createRenderFrame(parentFrame as Frame | undefined);

    try {
      const runtime = createRuntimeWithContext(state.path, ctx ?? {});
      const rootResult = await state.rootRenderFunc?.(state.env, context, frame, runtime);
      const result = rootResult === undefined ? undefined : (Array.isArray(rootResult) ? rootResult[0] : rootResult);
      if (runtime.__warnings__.length > 0 && state.env.opts.dev) {
        return result + injectWarningsScript(runtime.__warnings__ as Warning[], { dev: true, verbosity: 'medium' });
      }
      return result as string;
    } catch (e) {
      throw wrapRenderError(state, e);
    } finally {
      renderingTemplates?.delete(state.path);
    }
  };

  return { render };
};

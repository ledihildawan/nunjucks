import { createContext, createFrame, collectStream, type BlockLocation, type Context, type Frame } from '@nunjucks/runtime';
import { prettifyError } from '@nunjucks/log';
import type { TemplateState } from './types';
import { createRuntimeWithContext } from './runtime-factory';

export { createGetExported };

const createGetExported = (
  getState: () => TemplateState,
  compiler: { safeCompile: () => Promise<void> },
) => async (ctx?: Record<string, unknown>, parentFrame?: unknown): Promise<Record<string, unknown>> => {
  const createExportedFrame = (inputParentFrame: Frame | undefined): Frame => {
    const exportFrame = inputParentFrame ? inputParentFrame.push() : createFrame();
    exportFrame.topLevel = true;
    return exportFrame;
  };

  try {
    await compiler.safeCompile();
  } catch (e) {
    const state = getState();
    throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state.includeChain ?? undefined });
  }

  const state = getState();

  const wrapExportedError = (e: unknown): never => {
    const path = (e as { path?: string }).path ?? state.path;
    throw prettifyError({ path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state.includeChain ?? undefined });
  };

  const renderFrame = createExportedFrame(parentFrame as Frame | undefined);

  const context = createContext({
    ctx: ctx ?? {},
    blocks: state.blocks,
    env: state.env,
    metadata: { blockLocations: state.blockMeta as Record<string, BlockLocation> },
  });
  try {
    const runtime = createRuntimeWithContext(state.path, ctx ?? {});
    const rootGen = state.rootRenderFunc?.(state.env, context, renderFrame, runtime);
    // WHY: root is now an async generator (Option B); drain it to capture the post-render context it returns (immutable addExport/setVariable writes live there). Fall back to the original context if root is absent or returns none.
    if (rootGen === undefined) {
      return context.getExported();
    }
    const { context: drainedContext } = await collectStream(rootGen);
    const finalContext = (drainedContext as Context | undefined) ?? context;
    return finalContext.getExported();
  } catch (e) {
    return wrapExportedError(e);
  }
};

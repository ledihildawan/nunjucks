import { createContext, createFrame, type BlockLocation, type Frame } from '@nunjucks/runtime';
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
    throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain ?? undefined });
  }

  const state = getState();

  const wrapExportedError = (e: unknown): never => {
    const path = (e as { path?: string }).path ?? state.path;
    throw prettifyError({ path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain ?? undefined });
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
    await state.rootRenderFunc?.(state.env, context, renderFrame, runtime);
    return context.getExported();
  } catch (e) {
    return wrapExportedError(e);
  }
};

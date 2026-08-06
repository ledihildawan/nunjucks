import { createContext, createFrame, type BlockLocation, type Frame } from '@nunjucks/runtime';
import { prettifyError } from '@nunjucks/log';
import type { TemplateState } from './types';
import { createRuntimeWithContext } from './runtime-factory';

export { createGetExported };

const createGetExported = (state: TemplateState) => async (ctx?: Record<string, unknown>, parentFrame?: unknown): Promise<Record<string, unknown>> => {
  const createExportedFrame = (parentFrame: Frame | undefined): Frame => {
    const frame = parentFrame ? parentFrame.push() : createFrame();
    frame.topLevel = true;
    return frame;
  };

  const wrapExportedError = (e: unknown): never => {
    const path = (e as { path?: string }).path ?? state.path;
    throw prettifyError({ path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain || undefined });
  };

  try {
    await state.compiler?.safeCompile();
  } catch (e) {
    throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain || undefined });
  }

  const frame = createExportedFrame(parentFrame as Frame | undefined);

  const context = createContext(
    ctx || {},
    state.blocks,
    state.env,
    { blockLocations: state.blockMeta as Record<string, BlockLocation> }
  );
  try {
    const runtime = createRuntimeWithContext(state.path, ctx || {});
    await state.rootRenderFunc?.(state.env, context, frame, runtime);
    return context.getExported();
  } catch (e) {
    return wrapExportedError(e);
  }
};

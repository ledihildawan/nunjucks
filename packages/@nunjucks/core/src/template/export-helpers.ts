import { createContext } from '@nunjucks/runtime/context';
import type { ContextEnv, BlockLocation } from '@nunjucks/runtime/context';
import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { prettifyError } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import type { TemplateState } from './types';
import { createRuntimeWithContext } from './runtime-helpers';

export { createGetExported };

const createGetExported = (state: TemplateState) => async (ctx?: unknown, parentFrame?: unknown): Promise<Record<string, unknown>> => {
  const createExportedFrame = (parentFrame: unknown): Frame => {
    const frame = parentFrame ? (parentFrame as Pick<Frame, 'push'>).push() : createFrame();
    frame.topLevel = true;
    return frame;
  };

  const wrapExportedError = (e: unknown): never => {
    if (!(e as Record<string, unknown>).path) { (e as Record<string, unknown>).path = state.path || undefined; }
    throw prettifyError({ path: (e as Record<string, unknown>).path as string, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain as unknown as IncludeChain | undefined });
  };

  try {
    await state.compiler?.safeCompile();
  } catch (e) {
    throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain as unknown as IncludeChain | undefined });
  }

  const frame = createExportedFrame(parentFrame);

  const context = createContext(
    (ctx || {}) as Record<string, unknown>,
    state.blocks,
    state.env as unknown as ContextEnv,
    { blockLocations: state.blockMeta as Record<string, BlockLocation> }
  );
  try {
    const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
    await state.rootRenderFunc?.(state.env, context, frame, runtime);
    return context.getExported();
  } catch (e) {
    wrapExportedError(e);
  }
};

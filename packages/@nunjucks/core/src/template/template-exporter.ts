import { normalizeErrorMetadata, prettifyError } from '@nunjucks/error-formatter';
import { isKeyedObject } from '@nunjucks/lib';
import { collectStream } from '@nunjucks/lib/collect-stream';
import {
  type BlockLocation,
  type Context,
  createContext,
  createFrame,
  type Frame,
} from '@nunjucks/runtime';
import { createRuntimeWithContext } from './runtime-factory';
import type { TemplateState } from './types';

export { createGetExported };

const createGetExported =
  (getState: () => TemplateState, compiler: { safeCompile: () => Promise<void> }) =>
  async (
    ctx?: Record<string, unknown>,
    parentFrame?: unknown
  ): Promise<Record<string, unknown>> => {
    const createExportedFrame = (inputParentFrame: Frame | undefined): Frame =>
      createFrame({ parent: inputParentFrame, topLevel: true });

    try {
      await compiler.safeCompile();
    } catch (e: unknown) {
      const state = getState();
      throw prettifyError({
        path: state.path,
        withInternals: state.env.opts.dev,
        err: normalizeErrorMetadata(e).error,
        includeChain: state.includeChain ?? undefined,
      });
    }

    const state = getState();

    const wrapExportedError = (e: unknown): never => {
      const path =
        (isKeyedObject(e) && typeof e.path === 'string' ? e.path : undefined) ?? state.path;
      throw prettifyError({
        path,
        withInternals: state.env.opts.dev,
        err: normalizeErrorMetadata(e).error,
        includeChain: state.includeChain ?? undefined,
      });
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
      const { returnValue: drainedContext } = await collectStream(rootGen);
      const finalContext = (drainedContext as Context | undefined) ?? context;
      return finalContext.getExported();
    } catch (e: unknown) {
      return wrapExportedError(e);
    }
  };

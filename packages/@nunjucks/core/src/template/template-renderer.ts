import type { Warning } from '@nunjucks/error-catalog';
import { getError } from '@nunjucks/error-catalog';
import { createLog, normalizeErrorMetadata, prettifyError } from '@nunjucks/error-formatter';
import { injectWarningsScript } from '@nunjucks/error-renderer';
import { collectStream } from '@nunjucks/lib/collect-stream';
import { type BlockLocation, createContext, createFrame, type Frame } from '@nunjucks/runtime';
import { createRuntimeWithContext } from './runtime-factory';
import type { ErrorWithLineInfo } from './template-error-handler';
import type { TemplateState } from './types';

export { createRenderFrame, createTemplateRenderer };

// WHY: custom filters can throw non-Error values (null, strings). normalizeErrorMetadata soundly converts
// any thrown value into an Error (stringified message) before line-info enrichment reads .lineno/.path —
// the widening cast is safe because every added field is optional.
const toErrorWithLineInfo = (e: unknown): ErrorWithLineInfo =>
  normalizeErrorMetadata(e).error as ErrorWithLineInfo;

const createRenderFrame = (parentFrame: Frame | undefined): Frame => {
  const frame = parentFrame ? parentFrame.push(true) : createFrame();
  frame.topLevel = true;
  return frame;
};

const createTemplateRenderer = (
  getState: () => TemplateState,
  compiler: { safeCompile: () => Promise<void> },
  errorHandler: { enrichError: (e: ErrorWithLineInfo) => Error }
) => {
  const { enrichError } = errorHandler;

  const wrapRenderError = (state: TemplateState, e: unknown): Error => {
    const errorInfo = toErrorWithLineInfo(e);
    return prettifyError({
      path: errorInfo.path ?? state.path,
      withInternals: state.env.opts.dev,
      err: enrichError(errorInfo),
      includeChain: errorInfo.includeChain ?? state.includeChain ?? undefined,
    });
  };

  const render = async (ctx: Record<string, unknown>, parentFrame?: unknown): Promise<string> => {
    await compiler.safeCompile();
    const state = getState();

    const renderingTemplates = state.env.renderingTemplates;
    // WHY: this Set lives on the shared env to detect truly circular includes (A includes A).
    // Limitation: it is NOT scoped to a single render pass, so two CONCURRENT independent
    // renders of the SAME path on one env will spuriously trip CIRCULAR_INCLUDE (the second
    // render sees the first's still-active entry). Callers that render the same template path
    // concurrently must isolate by using a separate env per render (or per concurrency unit).
    if (renderingTemplates?.has(state.path)) {
      throw createLog('error', {
        def: getError('CIRCULAR_INCLUDE'),
        params: { path: state.path as string },
        subject: state.path as string,
        context: { phase: 'render' },
      });
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
      const rootGen = state.rootRenderFunc?.(state.env, context, frame, runtime);
      // WHY: rootRenderFunc is optional (?.); a missing root means compilation produced no entry
      // point, so surface it via the error catalog instead of casting an undefined result to string.
      if (rootGen === undefined) {
        throw createLog('error', {
          def: {
            ...getError('TEMPLATE_NO_RENDER'),
            message: () =>
              `Template "${state.path ?? 'undefined'}" has no compiled root render function`,
          },
          params: {},
          subject: state.path ?? null,
          context: { phase: 'render' },
        });
      }
      // WHY: root is now an async generator (Option B) — drain it to a string; ignore the returned context here (this path returns rendered output only).
      const { output: result } = await collectStream(rootGen);
      if (runtime.__warnings__.length > 0 && state.env.opts.dev) {
        return (
          result +
          injectWarningsScript(runtime.__warnings__ as Warning[], {
            dev: true,
            verbosity: 'medium',
          })
        );
      }
      return result;
    } catch (e: unknown) {
      throw wrapRenderError(state, e);
    } finally {
      renderingTemplates?.delete(state.path);
    }
  };

  return { render };
};

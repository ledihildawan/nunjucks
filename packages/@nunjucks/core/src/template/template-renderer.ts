import type { Warning } from '@nunjucks/error-catalog';
import { getError } from '@nunjucks/error-catalog';
import { createLog, normalizeErrorMetadata, prettifyError } from '@nunjucks/error-formatter';
import { injectWarningsScript } from '@nunjucks/error-renderer';
import { collectStream } from '@nunjucks/lib';
import { createContext, createFrame, type Frame } from '@nunjucks/runtime';
import { WARNINGS_CONTEXT_KEY } from '@nunjucks/shared';
import { createRuntimeWithContext } from './runtime-factory.ts';
import type { ErrorWithLineInfo } from './template-error-handler.ts';
import type { TemplateState } from './types.ts';

export { createRenderFrame, createTemplateRenderer };

// WHY: custom filters can throw non-Error values (null, strings). normalizeErrorMetadata soundly converts
// any thrown value into an Error (stringified message) before line-info enrichment reads .lineno/.path —
// the widening cast is safe because every added field is optional.
const toErrorWithLineInfo = (e: unknown): ErrorWithLineInfo =>
  normalizeErrorMetadata(e).error as ErrorWithLineInfo;

/** Creates a top-level render frame — write-isolated when nested under a parent. */
const createRenderFrame = (parentFrame: Frame | undefined): Frame =>
  createFrame({ parent: parentFrame, isolateWrites: parentFrame !== undefined, topLevel: true });

interface TemplateRendererOptions {
  getState: () => TemplateState;
  compiler: { safeCompile: () => Promise<void> };
  errorHandler: { enrichError: (e: ErrorWithLineInfo) => Error };
}

/**
 * Creates the template renderer — compiles on demand, guards circular
 * includes via the env-scoped set, drains the root generator to a string,
 * and enriches any thrown error with path/include-chain context.
 */
const createTemplateRenderer = ({ getState, compiler, errorHandler }: TemplateRendererOptions) => {
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

  const render = async (
    ctx: Record<string, unknown>,
    parentFrame?: Frame,
    warningsCollector?: unknown[]
  ): Promise<string> => {
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
        subject: state.path ?? 'unknown',
        context: { phase: 'render' },
      });
    }

    renderingTemplates?.add(state.path);

    const context = createContext({
      ctx: ctx ?? {},
      blocks: state.blocks,
      env: state.env,
      metadata: { blockLocations: state.blockMeta },
    });
    const frame = createRenderFrame(parentFrame);

    try {
      // WHY: warningsCollector arrives from the compiled include call (render arg 3) —
      // sharing the ROOT collector keeps include-emitted warnings on the page; without
      // it each include got a private throwaway array nobody drained.
      const runtime = createRuntimeWithContext(state.path, ctx ?? {}, warningsCollector);
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
      const warnings = runtime[WARNINGS_CONTEXT_KEY];
      // WHY: root template only — includes render through this same path with a
      // non-null includeChain; injecting per include emitted one <script> block per
      // included template instead of a single page-level warnings script.
      if (warnings.length > 0 && state.env.opts.dev && !state.includeChain) {
        return (
          result +
          // WHY: widening cast — the warnings collector is engine-populated (collected
          // TemplateWarning objects), never untrusted input; the key is stringly-typed.
          injectWarningsScript(warnings as Warning[], {
            dev: true,
            verbosity: 'medium',
          })
        );
      }
      return result;
    } catch (renderErr: unknown) {
      throw wrapRenderError(state, renderErr);
    } finally {
      renderingTemplates?.delete(state.path);
    }
  };

  return { render };
};

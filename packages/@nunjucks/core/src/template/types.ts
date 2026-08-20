import type { IncludeChain } from '@nunjucks/error-formatter';
import type { BlockFn, BlockLocation, Env, Frame } from '@nunjucks/runtime';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import type { RuntimeContext } from './runtime-context.ts';

export { Template };

/** Branding symbol carried by every `TemplateObject` handle created via `createTemplate`. */
const Template = Symbol('Template');

/**
 * Root renderer ABI shared by every compiled template: receives the render env,
 * the context, the root frame, and the runtime helpers; yields output chunks
 * as strings and returns the post-render context.
 */
type RootRenderFunc = (
  env: Env,
  context: unknown,
  frame: unknown,
  runtime: RuntimeContext
) => AsyncGenerator<string, unknown>;

/** Shared template state — env, path, include chain, and block maps. */
type TemplateStateBase = {
  env: Env;
  path: string | undefined;
  includeChain: IncludeChain | null;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
};

/** The template state machine — `source` with raw text, or `compiled` with loaded exports. */
type TemplateState = TemplateStateBase &
  (
    | { status: 'source'; tmplStr: string; tmplProps: null; rootRenderFunc: null }
    | {
        status: 'compiled';
        tmplStr: null;
        tmplProps: CompiledTemplateExports;
        rootRenderFunc: RootRenderFunc;
      }
  );

/**
 * Template input as a closed discriminated union — `code` carries
 * pre-compiled exports, `string` carries raw template source. The tag/payload
 * correlation is total: `{ type: 'string', value: 42 }` is unrepresentable, so
 * consumers narrow by `type` without re-validating `value`'s shape.
 */
export type TemplateSource =
  | { readonly type: 'code'; readonly value: CompiledTemplateExports }
  | { readonly type: 'string'; readonly value: string };

/**
 * The public template handle — env/path/block accessors plus `render`,
 * `compile`, and `getExported` over the shared state machine.
 */
export interface TemplateObject {
  readonly [key: symbol]: true;
  env: Env;
  path: string | undefined;
  compiled: boolean;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
  rootRenderFunc: RootRenderFunc | null;
  // WHY: warningsCollector is threaded by compiled {% include %} code (render arg 3)
  // so include-emitted warnings land in the ROOT render's collector and surface once
  // per page instead of vanishing in a per-include throwaway runtime.
  /**
   * Renders the template; compiles first when still in `source` state.
   *
   * @throws TemplateError on load, compile, or render failure — this subpath
   * throws by design (see the module header); the Result-based pipeline catches.
   */
  render: (
    ctx: Record<string, unknown>,
    parentFrame?: Frame,
    warningsCollector?: unknown[]
  ) => Promise<string>;
  /** Compiles eagerly; re-compiles are no-ops once in `compiled` state. @throws TemplateError on compile failure. */
  compile: () => void;
  /**
   * Runs the template discarding output, returning its exported macro/blocks.
   * @throws TemplateError like {@link render}.
   */
  getExported: (
    ctx?: Record<string, unknown>,
    parentFrame?: Frame
  ) => Promise<Record<string, unknown>>;
}

export type { RootRenderFunc, TemplateState, TemplateStateBase };

import type { IncludeChain } from '@nunjucks/error-formatter';
import type { BlockFn, BlockLocation, Env, Frame } from '@nunjucks/runtime';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import type { RuntimeContext } from './runtime-context.ts';

export { Template };

const Template = Symbol('Template');

// WHY: Option B — root renders as an async generator yielding output chunks and returning the post-render context.
type RootRenderFunc = (
  env: Env,
  context: unknown,
  frame: unknown,
  runtime: RuntimeContext
) => AsyncGenerator<string, unknown>;

type TemplateStateBase = {
  env: Env;
  path: string | undefined;
  includeChain: IncludeChain | null;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
};

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

// WHY: discriminated union correlates the tag with its payload — `{ type: 'string', value: 42 }`
// is unrepresentable, so consumers narrow by `type` without re-validating `value`'s shape.
export type TemplateSource =
  | { readonly type: 'code'; readonly value: CompiledTemplateExports }
  | { readonly type: 'string'; readonly value: string };

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
  render: (
    ctx: Record<string, unknown>,
    parentFrame?: Frame,
    warningsCollector?: unknown[]
  ) => Promise<string>;
  compile: () => void;
  getExported: (
    ctx?: Record<string, unknown>,
    parentFrame?: Frame
  ) => Promise<Record<string, unknown>>;
}

export type { RootRenderFunc, TemplateState, TemplateStateBase };

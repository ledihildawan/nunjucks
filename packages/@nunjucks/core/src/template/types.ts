import type { Env, BlockLocation, BlockFn } from '@nunjucks/runtime';
import type { IncludeChain } from '@nunjucks/log';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import type { RuntimeContext } from './runtime-context.ts';

export { Template };

const Template = Symbol('Template');

// WHY: Option B — root renders as an async generator yielding output chunks and returning the post-render context.
type RootRenderFunc = (env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => AsyncGenerator<string, unknown>;

type TemplateStateBase = {
  env: Env;
  path: string | undefined;
  includeChain: IncludeChain | null;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
};

type TemplateState = TemplateStateBase & (
  | { status: 'source'; tmplStr: string; tmplProps: null; rootRenderFunc: null }
  | { status: 'compiled'; tmplStr: null; tmplProps: CompiledTemplateExports; rootRenderFunc: RootRenderFunc }
);

export interface TemplateSource {
  type: 'code' | 'string';
  value: unknown;
}

export interface TemplateObject {
  readonly [key: symbol]: true;
  env: Env;
  path: string | undefined;
  compiled: boolean;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
  rootRenderFunc: RootRenderFunc | null;
  render: (ctx: Record<string, unknown>, parentFrame?: unknown) => Promise<string>;
  compile: () => void;
  getExported: (ctx?: Record<string, unknown>, parentFrame?: unknown) => Promise<Record<string, unknown>>;
}

export type { TemplateState, TemplateStateBase, RootRenderFunc };

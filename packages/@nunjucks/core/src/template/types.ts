import type { Env, BlockLocation, BlockFn } from '@nunjucks/runtime';
import type { IncludeChain } from '@nunjucks/log';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import type { RuntimeContext } from './runtime-context.ts';

export { Template };

const Template = Symbol('Template');

export interface TemplateState {
  env: Env;
  path: string | undefined;
  includeChain: IncludeChain | null;
  tmplStr: string | null;
  tmplProps: CompiledTemplateExports | null;
  blocks: Record<string, BlockFn>;
  blockMeta: Record<string, BlockLocation>;
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  compiled: boolean;
}

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
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  render: (ctx: Record<string, unknown>, parentFrame?: unknown) => Promise<string>;
  compile: () => void;
  getExported: (ctx?: Record<string, unknown>, parentFrame?: unknown) => Promise<Record<string, unknown>>;
}

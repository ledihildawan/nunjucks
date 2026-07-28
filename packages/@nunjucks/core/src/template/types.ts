import type { Env } from '../core/env.ts';
import type { RuntimeContext } from './runtime-context.ts';

export { Template };

const Template = Symbol('Template');

export interface TemplateState {
  env: Env;
  path: string | undefined;
  _includeChain: unknown[] | null;
  tmplStr: string | null;
  tmplProps: Record<string, unknown> | null;
  blocks: Record<string, (...args: unknown[]) => unknown>;
  blockMeta: Record<string, unknown>;
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  compiled: boolean;
  compiler?: {
    compile: () => void;
    safeCompile: () => Promise<void>;
  };
}

export interface TemplateSource {
  type: 'code' | 'string';
  obj: unknown;
}

export interface TemplateObject {
  [Template]: true;
  env: Env;
  path: string | undefined;
  compiled: boolean;
  blocks: Record<string, (...args: unknown[]) => unknown>;
  blockMeta: Record<string, unknown>;
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  render: (ctx: unknown, parentFrame?: unknown) => Promise<string>;
  compile: () => void;
  getExported: (ctx?: unknown, parentFrame?: unknown) => Promise<Record<string, unknown>>;
}

import { pipe, filter, map } from 'remeda';

export const BLOCK_META_KEY = '__blockMeta';

export type CompiledRenderSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown,
) => AsyncGenerator<string, unknown>;

export type CompiledBlockSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown,
) => AsyncGenerator<string, unknown>;

export interface CompiledTemplateExports {
  root: CompiledRenderSignature;
  [blockName: string]: CompiledRenderSignature | CompiledBlockSignature | Record<string, unknown>;
  [BLOCK_META_KEY]: Record<string, unknown>;
}

export const isCompiledTemplateExports = (value: unknown): value is CompiledTemplateExports => {
  if (!value || typeof value !== 'object') { return false; }
  return typeof (value as { root?: unknown }).root === 'function';
};

export const extractBlocks = <T = unknown>(
  source: Record<string, T>
): Partial<Record<string, T>> =>
  pipe(
    Object.entries(source),
    filter(([key]: readonly [string, T]) => key.startsWith('b_')),
    map(([key, value]: readonly [string, T]) => [key.slice(2), value]),
    Object.fromEntries,
  ) as Partial<Record<string, T>>;

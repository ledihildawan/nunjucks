
export const BLOCK_META_KEY = '__blockMeta';

export type CompiledRenderSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown,
) => Promise<string> | string;

export interface CompiledTemplateExports {
  root: CompiledRenderSignature;
  [blockName: string]: CompiledRenderSignature | Record<string, unknown>;
  [BLOCK_META_KEY]: Record<string, unknown>;
}

export const isCompiledTemplateExports = (value: unknown): value is CompiledTemplateExports => {
  if (!value || typeof value !== 'object') { return false; }
  return typeof (value as { root?: unknown }).root === 'function';
};

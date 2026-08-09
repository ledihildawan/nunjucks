
export const BLOCK_META_KEY = '__blockMeta';

// WHY: Option B streaming — the compiled `root` is an async generator that yields output chunks and returns the post-render context (so immutable-context writes — setVariable/addBlock/addExport — remain observable to import/getExported callers). Block/slot functions still return a plain string. Consumers drain root via collectString for blocking rendering.
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
) => Promise<string> | string;

export interface CompiledTemplateExports {
  root: CompiledRenderSignature;
  [blockName: string]: CompiledRenderSignature | CompiledBlockSignature | Record<string, unknown>;
  [BLOCK_META_KEY]: Record<string, unknown>;
}

export const isCompiledTemplateExports = (value: unknown): value is CompiledTemplateExports => {
  if (!value || typeof value !== 'object') { return false; }
  return typeof (value as { root?: unknown }).root === 'function';
};


export const BLOCK_META_KEY = '__blockMeta';

// WHY: the compiled `root` function returns [output, context] so immutable-context writes (setVariable/addBlock/addExport) performed during render remain observable to callers that need the post-render context (e.g. template import/getExported). Block functions still return a plain string. Consumers narrow via Array.isArray, keeping hand-written string returns valid.
export type RenderResult = string | [string, unknown];

export type CompiledRenderSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown,
) => Promise<RenderResult> | RenderResult;

export interface CompiledTemplateExports {
  root: CompiledRenderSignature;
  [blockName: string]: CompiledRenderSignature | Record<string, unknown>;
  [BLOCK_META_KEY]: Record<string, unknown>;
}

export const isCompiledTemplateExports = (value: unknown): value is CompiledTemplateExports => {
  if (!value || typeof value !== 'object') { return false; }
  return typeof (value as { root?: unknown }).root === 'function';
};

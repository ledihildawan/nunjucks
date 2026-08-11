export * from './create-compiler.ts';
export { BLOCK_META_KEY, isCompiledTemplateExports, type CompiledRenderSignature, type CompiledBlockSignature, type CompiledTemplateExports } from './codegen-contract.ts';
export { extractBlocks } from './extract-blocks.ts';
export { lineDistance, positionAtOffset, findAllOccurrences } from './diagnostics/text-position.ts';

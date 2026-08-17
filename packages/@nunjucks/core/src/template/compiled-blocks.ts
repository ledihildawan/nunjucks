import type { BlockFn, BlockLocation } from '@nunjucks/runtime';
import { BLOCK_META_KEY, type CompiledTemplateExports, extractBlocks } from '@nunjucks/shared';

// WHY: the compiled-exports → state narrowing must live exactly once — the compiler's
// commit() and the include-path adoptCompiledExports() have to produce shape-identical
// block maps, and the widening cast is only sanctioned against trusted generated code.
export const extractCompiledBlocks = (
  compiledExports: CompiledTemplateExports
): { blocks: Record<string, BlockFn>; blockMeta: Record<string, BlockLocation> } => ({
  blocks: extractBlocks(compiledExports) as Record<string, BlockFn>,
  blockMeta: (compiledExports[BLOCK_META_KEY] as Record<string, BlockLocation>) ?? {},
});

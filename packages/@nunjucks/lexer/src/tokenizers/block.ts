import type { TokenType } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeBlockStart = createDelimiterTokenizer(
  'block-start' as TokenType, 'STRIP_BLOCK_START', 'BLOCK_START', { stripLeft: true },
);
export const tokenizeBlockEnd = createDelimiterTokenizer(
  'block-end' as TokenType, 'STRIP_BLOCK_END', 'BLOCK_END', { stripRight: true },
);

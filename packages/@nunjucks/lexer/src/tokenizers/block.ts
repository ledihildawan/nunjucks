import { TOKEN_BLOCK_START, TOKEN_BLOCK_END } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeBlockStart = createDelimiterTokenizer(
  TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
);
export const tokenizeBlockEnd = createDelimiterTokenizer(
  TOKEN_BLOCK_END, 'stripBlockEnd', 'blockEnd', { stripRight: true },
);

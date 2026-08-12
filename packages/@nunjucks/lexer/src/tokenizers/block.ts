import { TOKEN_BLOCK_START, TOKEN_BLOCK_END } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeBlockStart = createDelimiterTokenizer({
  tokenType: TOKEN_BLOCK_START,
  stripKey: 'stripBlockStart',
  plainKey: 'blockStart',
  stripFlag: { stripLeft: true },
});
export const tokenizeBlockEnd = createDelimiterTokenizer({
  tokenType: TOKEN_BLOCK_END,
  stripKey: 'stripBlockEnd',
  plainKey: 'blockEnd',
  stripFlag: { stripRight: true },
});

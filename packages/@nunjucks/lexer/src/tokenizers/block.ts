import { TOKEN_BLOCK_END, TOKEN_BLOCK_START } from '../token-types.ts';
import type { LexerState } from '../types.ts';
import { advance, getChar } from '../state.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeBlockStart = createDelimiterTokenizer({
  tokenType: TOKEN_BLOCK_START,
  stripKey: 'stripBlockStart',
  plainKey: 'blockStart',
  stripFlag: { stripLeft: true },
});

const delimiterBlockEnd = createDelimiterTokenizer({
  tokenType: TOKEN_BLOCK_END,
  stripKey: 'stripBlockEnd',
  plainKey: 'blockEnd',
  stripFlag: { stripRight: true },
});

// WHY: trimBlocks skips exactly ONE newline directly after a block-end tag (\n or \r\n).
// A bare \r not followed by \n is left untouched, matching the original engine's CRLF
// handling. The `-%}` strip form already removes all following whitespace, so the skip
// is a no-op there.
const skipTrimBlocksNewline = (state: LexerState): LexerState => {
  const char = getChar(state);
  if (char === '\n') {
    return advance(state);
  }
  if (char === '\r') {
    const afterCr = advance(state);
    return getChar(afterCr) === '\n' ? advance(afterCr) : state;
  }
  return state;
};

export const tokenizeBlockEnd = (state: Parameters<typeof delimiterBlockEnd>[0]) => {
  const step = delimiterBlockEnd(state);
  if (step === null || !state.trimBlocks) {
    return step;
  }
  return { ...step, state: skipTrimBlocksNewline(step.state) };
};

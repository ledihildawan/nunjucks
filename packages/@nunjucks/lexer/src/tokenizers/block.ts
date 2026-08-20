import { advance, getChar } from '../state.ts';
import { TOKEN_BLOCK_END, TOKEN_BLOCK_START } from '../token-types.ts';
import type { LexerState } from '../types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

/** Tokenizes `{%` and its strip form `{%-`, flagging `stripLeft` for the strip variant. */
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

/**
 * Tokenizes `%}` and its strip form `-%}`; when `trimBlocks` is enabled the state is
 * advanced past exactly one trailing newline (bare `\r` without `\n` is left as-is).
 */
export const tokenizeBlockEnd = (state: Parameters<typeof delimiterBlockEnd>[0]) => {
  const step = delimiterBlockEnd(state);
  if (step === null || !state.trimBlocks) {
    return step;
  }
  return { ...step, state: skipTrimBlocksNewline(step.state) };
};

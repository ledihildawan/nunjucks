import { advance, getChar, matches } from '../state.ts';
import { TOKEN_DATA } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';
import { tokenizeBlockStart } from './block.ts';

// WHY: lstripBlocks strips ONLY line-leading whitespace before a BLOCK tag ({% ... %}),
// never before {{ }} or {# #}. The last line of the data must be whitespace-only AND the
// run must begin at column 0 of the line. The class is the original engine's /^\s+$/
// (which includes \u00A0), unlike {{ }}/{# #} tags which never strip.
const LINE_LEADING_WS_RE = /^\s+$/;

const applyLstripBlocks = (text: string, state: LexerState, current: LexerState): string => {
  if (!state.lstripBlocks || !matches(current, state.tags.blockStart)) {
    return text;
  }
  const lastLineStart = text.lastIndexOf('\n') + 1;
  const lastLine = text.slice(lastLineStart);
  if (!LINE_LEADING_WS_RE.test(lastLine)) {
    return text;
  }
  // WHY: a whitespace-only last line strips only when it begins at column 0 of the
  // line — the original lexer's `colno <= tok.length` check. A chunk that starts
  // mid-line (e.g. the spaces after `}}` in `A{{ x }}   {% if %}`) keeps its
  // whitespace; a chunk preceded by a newline inside the text always starts its
  // last line at column 0.
  const beginsAtLineStart = lastLineStart > 0 || state.colno === 0;
  return beginsAtLineStart ? text.slice(0, lastLineStart) : text;
};

/**
 * Tokenizes template data up to the next tag start (`{%`, `{{`, or `{#`); applies
 * `lstripBlocks` to the final line and delegates to the block-start tokenizer when the
 * whole chunk was stripped, so no empty data token is emitted.
 */
export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) {
    return null;
  }

  const { lineno, colno } = state;
  // WHY: while loop instead of the previous per-character recursion — a single large
  // text run overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let current = state;
  let text = '';
  while (
    current.index < current.source.length &&
    !matches(current, current.tags.blockStart) &&
    !matches(current, current.tags.variableStart) &&
    !matches(current, current.tags.commentStart)
  ) {
    text += getChar(current);
    current = advance(current);
  }
  const dataText = applyLstripBlocks(text, state, current);

  if (!dataText) {
    // WHY: lstripBlocks consumed the whole data chunk (pure whitespace before a block
    // tag) — delegate to the block-start tokenizer so no empty data token is emitted.
    return tokenizeBlockStart(current);
  }
  return {
    token: createToken({ type: TOKEN_DATA, value: dataText, lineno, colno }),
    state: current,
  };
};

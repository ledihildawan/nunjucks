import type { Tokenizer, TokenizeResult } from '../types.ts';

import { tokenizeWhitespace } from './whitespace.ts';
import { tokenizeNumber } from './number.ts';
import { tokenizeString } from './string.ts';
import { tokenizeSymbol } from './symbol.ts';
import { tokenizeOperator } from './operator.ts';
import { tokenizeBlockStart, tokenizeBlockEnd } from './block.ts';
import { tokenizeVariableStart, tokenizeVariableEnd } from './variable.ts';
import { tokenizeTemplateText } from './template-text.ts';
import { tokenizeComment } from './comment.ts';
import { tokenizeTemplateLiteral } from './template-literal.ts';
import { tokenizeRaw } from './raw.ts';

// Re-exported from their own modules; the imports above feed the combinators
// defined below in this file.
export { tokenizeWhitespace } from './whitespace.ts';
export { tokenizeNumber } from './number.ts';
export { tokenizeString } from './string.ts';
export { tokenizeSymbol } from './symbol.ts';
export { tokenizeOperator } from './operator.ts';
export { tokenizeBlockStart, tokenizeBlockEnd } from './block.ts';
export { tokenizeVariableStart, tokenizeVariableEnd } from './variable.ts';
export { tokenizeTemplateText } from './template-text.ts';
export { tokenizeComment } from './comment.ts';
export { tokenizeTemplateLiteral } from './template-literal.ts';
export { tokenizeRaw } from './raw.ts';

export const or = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) { return result; }
  }
  return null;
};

export const templateTokenizers = or(
  tokenizeRaw,
  tokenizeBlockStart,
  tokenizeVariableStart,
  tokenizeComment,
  tokenizeTemplateText,
);

export const codeTokenizers = or(
  tokenizeString,
  tokenizeTemplateLiteral,
  tokenizeWhitespace,
  tokenizeBlockEnd,
  tokenizeVariableEnd,
  tokenizeNumber,
  tokenizeSymbol,
  tokenizeOperator,
);

export const tokenizers = (state: import('../types').LexerState): TokenizeResult | null => {
  if (state.inCode) {
    return codeTokenizers(state);
  }
  return templateTokenizers(state);
};

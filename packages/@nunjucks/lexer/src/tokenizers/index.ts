import type { Tokenizer, TokenizeResult } from '../types';

import { tokenizeWhitespace } from './whitespace';
import { tokenizeNumber } from './number';
import { tokenizeString } from './string';
import { tokenizeSymbol } from './symbol';
import { tokenizeOperator } from './operator';
import { tokenizeBlockStart, tokenizeBlockEnd } from './block';
import { tokenizeVariableStart, tokenizeVariableEnd } from './variable';
import { tokenizeTemplateText } from './template-text';

export {
  tokenizeWhitespace,
  tokenizeNumber,
  tokenizeString,
  tokenizeSymbol,
  tokenizeOperator,
  tokenizeBlockStart,
  tokenizeBlockEnd,
  tokenizeVariableStart,
  tokenizeVariableEnd,
  tokenizeTemplateText,
};

export const or = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) return result;
  }
  return null;
};

export const templateTokenizers = or(
  tokenizeBlockStart,
  tokenizeVariableStart,
  tokenizeTemplateText,
);

export const codeTokenizers = or(
  tokenizeString,
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

import type { Tokenizer, TokenizeResult } from '../types';

import { tokenizeWhitespace } from './whitespace';
import { tokenizeNumber } from './number';
import { tokenizeString } from './string';
import { tokenizeSymbol } from './symbol';
import { tokenizeOperator } from './operator';
import { tokenizeBlockStart, tokenizeBlockEnd } from './block';
import { tokenizeVariableStart, tokenizeVariableEnd } from './variable';
import { tokenizeTemplateText } from './template-text';
import { tokenizeComment } from './comment';
import { tokenizeTemplateLiteral } from './template-literal';
import { tokenizeRaw } from './raw';

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
  tokenizeComment,
  tokenizeTemplateLiteral,
  tokenizeRaw,
};

export const or = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) return result;
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

import { firstMatch } from '../combinators.ts';
import type { LexerState, TokenStep } from '../types.ts';
import { tokenizeBlockEnd, tokenizeBlockStart } from './block.ts';
import { tokenizeComment } from './comment.ts';
import { tokenizeNumber } from './number.ts';
import { tokenizeOperator } from './operator.ts';
import { tokenizeRaw } from './raw.ts';
import { tokenizeString } from './string.ts';
import { tokenizeSymbol } from './symbol.ts';
import { tokenizeTemplateLiteral } from './template-literal.ts';
import { tokenizeTemplateText } from './template-text.ts';
import { tokenizeVariableEnd, tokenizeVariableStart } from './variable.ts';
import { tokenizeWhitespace } from './whitespace.ts';

export { tokenizeBlockEnd, tokenizeBlockStart } from './block.ts';
export { tokenizeComment } from './comment.ts';
export { tokenizeNumber } from './number.ts';
export { tokenizeOperator } from './operator.ts';
export { tokenizeRaw } from './raw.ts';
export { tokenizeString } from './string.ts';
export { tokenizeSymbol } from './symbol.ts';
export { tokenizeTemplateLiteral } from './template-literal.ts';
export { tokenizeTemplateText } from './template-text.ts';
export { tokenizeVariableEnd, tokenizeVariableStart } from './variable.ts';
export { tokenizeWhitespace } from './whitespace.ts';

const templateTokenizers = firstMatch(
  tokenizeRaw,
  tokenizeBlockStart,
  tokenizeVariableStart,
  tokenizeComment,
  tokenizeTemplateText
);

const codeTokenizers = firstMatch(
  tokenizeString,
  tokenizeTemplateLiteral,
  tokenizeWhitespace,
  tokenizeBlockEnd,
  tokenizeVariableEnd,
  tokenizeNumber,
  tokenizeSymbol,
  tokenizeOperator
);

/**
 * Tokenizes the next step from `state`: delegates to the first accepting
 * code-mode tokenizer while inside `{{ }}`/`{% %}` and to the first accepting
 * template-mode tokenizer in raw text; returns `null` when none applies.
 */
export const tokenize = (state: LexerState): TokenStep | null => {
  if (state.inCode) {
    return codeTokenizers(state);
  }
  return templateTokenizers(state);
};

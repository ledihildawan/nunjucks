import type { Tokenizer } from '../types';
import { getChar, getPeek, matches, advance, isFinished } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export interface TemplateQuasi {
  type: 'template' | 'expression';
  value: string;
}

export const tokenizeTemplateLiteral: Tokenizer = (state) => {
  if (getChar(state) !== '`') return null;

  let current = advance(state);
  let currentStr = '';
  const quasis: TemplateQuasi[] = [];

  while (!isFinished(current)) {
    const char = getChar(current);

    if (char === '$' && getPeek(current) === '{') {
      if (currentStr) {
        quasis.push({ type: 'template', value: currentStr });
        currentStr = '';
      }
      current = advance(current, 2);

      let exprDepth = 1;
      let exprContent = '';

      while (!isFinished(current) && exprDepth > 0) {
        const exprChar = getChar(current);

        if (exprChar === '{') {
          exprDepth++;
          exprContent += exprChar;
        } else if (exprChar === '}') {
          exprDepth--;
          if (exprDepth > 0) {
            exprContent += exprChar;
          }
        } else if (exprChar === '`' && exprDepth === 1) {
          throw new Error('Unexpected backtick in template expression');
        } else {
          exprContent += exprChar;
        }
        current = advance(current);
      }

      quasis.push({ type: 'expression', value: exprContent.trim() });
      continue;
    }

    if (char === '`') {
      if (currentStr) {
        quasis.push({ type: 'template', value: currentStr });
      }
      current = advance(current);
      break;
    }

    currentStr += char;
    current = advance(current);
  }

  return {
    token: createToken(
      'template-literal' as TokenType,
      { quasis, expressions: [] },
      state.lineno,
      state.colno
    ),
    state: current,
  };
};

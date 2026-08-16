import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import { createUnterminatedLiteralError } from '../literal-error.ts';
import { advance, getChar, getPeek, isFinished } from '../state.ts';
import { TOKEN_TEMPLATE_LITERAL } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

export interface TemplateQuasi {
  type: 'template' | 'expression';
  value: string;
}

type ParseInterpolationResult = {
  exprContent: string;
  current: LexerState;
};

const isBacktickInExpression = (exprChar: string, exprDepth: number): boolean =>
  exprChar === '`' && exprDepth === 1;

const processInterpolationChar = (
  exprChar: string,
  exprDepth: number
): { depthDelta: number; charToAdd: string } | null => {
  if (exprChar === '{') {
    return { depthDelta: 1, charToAdd: exprChar };
  }
  if (exprChar === '}') {
    return { depthDelta: -1, charToAdd: exprChar };
  }
  if (isBacktickInExpression(exprChar, exprDepth)) {
    throw createLog('error', {
      def: {
        name: 'UNEXPECTED_BACKTICK',
        message: () => 'Unexpected backtick in template expression',
        pattern: MATCH_ANY_RE,
      },
      params: {},
      subject: null,
      context: { lineno: null, colno: null, phase: 'parse', lineBase: 'zero' },
    });
  }
  return { depthDelta: 0, charToAdd: exprChar };
};

const parseInterpolation = (
  initial: LexerState,
  origin: LexerState
): ParseInterpolationResult => {
  // WHY: while loop instead of the previous per-character recursion — long interpolation
  // bodies overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md.
  let current = initial;
  let exprDepth = 1;
  let exprContent = '';
  while (!isFinished(current) && exprDepth > 0) {
    const result = processInterpolationChar(getChar(current), exprDepth);
    if (result) {
      const newDepth = exprDepth + result.depthDelta;
      if (result.depthDelta === 0 || newDepth > 0) {
        exprContent += result.charToAdd;
      }
      exprDepth = newDepth;
    }
    current = advance(current);
  }
  if (exprDepth > 0) {
    throw createUnterminatedLiteralError('template', origin);
  }
  return { exprContent, current };
};

const pushTemplateQuasi = (quasis: TemplateQuasi[], text: string): void => {
  if (text !== '') {
    quasis.push({ type: 'template', value: text });
  }
};

const consumeTemplateLoop = (
  initialCurrent: LexerState,
  origin: LexerState
): { quasis: TemplateQuasi[]; finalCurrent: LexerState } => {
  // WHY: while loop instead of the previous per-character recursion — long template
  // literals overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md. quasis is a locally-owned push accumulator (no per-iteration
  // spread) so each append stays O(1) and the array never escapes before returning.
  const quasis: TemplateQuasi[] = [];
  let current = initialCurrent;
  let currentStr = '';
  while (!isFinished(current)) {
    const char = getChar(current);

    if (char === '$' && getPeek(current) === '{') {
      pushTemplateQuasi(quasis, currentStr);
      const { exprContent, current: afterExpr } = parseInterpolation(advance(current, 2), origin);
      quasis.push({ type: 'expression', value: exprContent.trim() });
      currentStr = '';
      current = afterExpr;
      continue;
    }

    if (char === '`') {
      pushTemplateQuasi(quasis, currentStr);
      return { quasis, finalCurrent: advance(current) };
    }

    currentStr += char;
    current = advance(current);
  }
  throw createUnterminatedLiteralError('template', origin);
};

export const tokenizeTemplateLiteral: Tokenizer = (state) => {
  if (getChar(state) !== '`') {
    return null;
  }

  const initialCurrent = advance(state);
  const { quasis, finalCurrent } = consumeTemplateLoop(initialCurrent, state);

  return {
    token: createToken({
      type: TOKEN_TEMPLATE_LITERAL,
      value: { quasis, expressions: [] },
      lineno: state.lineno,
      colno: state.colno,
    }),
    state: finalCurrent,
  };
};

import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import { createUnterminatedLiteralError } from '../literal-error.ts';
import { advance, getChar, getPeek, isFinished } from '../state.ts';
import { type TemplateQuasi, TOKEN_TEMPLATE_LITERAL } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

type ParseInterpolationResult = {
  exprContent: string;
  current: LexerState;
};

const isBacktickInExpression = (exprChar: string, exprDepth: number): boolean =>
  exprChar === '`' && exprDepth === 1;

const throwUnexpectedBacktick = (current: LexerState): never => {
  throw createLog('error', {
    def: {
      name: 'UNEXPECTED_BACKTICK',
      message: () => 'Unexpected backtick in template expression',
      pattern: MATCH_ANY_RE,
    },
    params: {},
    subject: null,
    context: { lineno: current.lineno, colno: current.colno, phase: 'parse', lineBase: 'zero' },
  });
};

const processInterpolationChar = (exprChar: string): { depthDelta: number; charToAdd: string } => {
  if (exprChar === '{') {
    return { depthDelta: 1, charToAdd: exprChar };
  }
  if (exprChar === '}') {
    return { depthDelta: -1, charToAdd: exprChar };
  }
  return { depthDelta: 0, charToAdd: exprChar };
};

const parseInterpolation = (initial: LexerState, origin: LexerState): ParseInterpolationResult => {
  // WHY: while loop instead of the previous per-character recursion — long interpolation
  // bodies overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let current = initial;
  let exprDepth = 1;
  let exprContent = '';
  while (!isFinished(current) && exprDepth > 0) {
    const exprChar = getChar(current);
    // WHY: the backtick sentinel needs the live position, so it throws here rather
    // than inside processInterpolationChar (which has no state reference).
    if (isBacktickInExpression(exprChar, exprDepth)) {
      throwUnexpectedBacktick(current);
    }
    const result = processInterpolationChar(exprChar);
    const newDepth = exprDepth + result.depthDelta;
    if (result.depthDelta === 0 || newDepth > 0) {
      exprContent += result.charToAdd;
    }
    exprDepth = newDepth;
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
  // literals overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  // quasis is a locally-owned push accumulator (no per-iteration spread) so each append
  // stays O(1) and the array never escapes before returning.
  const quasis: TemplateQuasi[] = [];
  let current = initialCurrent;
  let currentStr = '';
  while (!isFinished(current)) {
    const char = getChar(current);

    // WHY: escape pairs are consumed wholesale so an escaped backtick (`a\`b`) or an
    // escaped interpolation (`a\${x}`) stays quasi text instead of terminating the
    // literal / opening an interpolation — same rule as parseStringContent.
    if (char === '\\') {
      currentStr += char + getPeek(current);
      current = advance(current, 2);
      continue;
    }

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

/**
 * Tokenizes a backtick template literal into `template` and `expression` quasis;
 * escape pairs stay quasi text, and stray backticks or EOF throw.
 */
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

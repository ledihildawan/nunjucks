import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
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

const parseInterpolation = (current: LexerState): ParseInterpolationResult => {
  const scan = (
    pos: LexerState,
    exprDepth: number,
    exprContent: string
  ): ParseInterpolationResult => {
    if (isFinished(pos) || exprDepth <= 0) {
      return { exprContent, current: pos };
    }
    const exprChar = getChar(pos);
    const result = processInterpolationChar(exprChar, exprDepth);
    if (result) {
      const newDepth = exprDepth + result.depthDelta;
      const newContent =
        result.depthDelta === 0 || newDepth > 0 ? exprContent + result.charToAdd : exprContent;
      return scan(advance(pos), newDepth, newContent);
    }
    return scan(advance(pos), exprDepth, exprContent);
  };
  return scan(current, 1, '');
};

const addTemplateQuasi = (quasis: TemplateQuasi[], currentStr: string): TemplateQuasi[] => {
  if (currentStr) {
    return [...quasis, { type: 'template', value: currentStr }];
  }
  return quasis;
};

const handleInterpolationStart = (
  current: LexerState,
  currentStr: string,
  quasis: TemplateQuasi[]
): { newCurrent: LexerState; newStr: string; quasis: TemplateQuasi[] } => {
  const newQuasis = addTemplateQuasi(quasis, currentStr);
  const newCurrent = advance(current, 2);
  return { newCurrent, newStr: '', quasis: newQuasis };
};

const finalizeTemplateLiteral = (
  current: LexerState,
  currentStr: string,
  quasis: TemplateQuasi[]
): { finalCurrent: LexerState; quasis: TemplateQuasi[] } => {
  const newQuasis = addTemplateQuasi(quasis, currentStr);
  return { finalCurrent: advance(current), quasis: newQuasis };
};

const consumeTemplateContent = (
  current: LexerState,
  currentStr: string
): { newCurrent: LexerState; newStr: string } => {
  const char = getChar(current);
  return {
    newCurrent: advance(current),
    newStr: currentStr + char,
  };
};

const consumeTemplateLoop = (
  initialCurrent: LexerState
): { quasis: TemplateQuasi[]; finalCurrent: LexerState } => {
  const scan = (
    current: LexerState,
    currentStr: string,
    quasis: TemplateQuasi[]
  ): { quasis: TemplateQuasi[]; finalCurrent: LexerState } => {
    if (isFinished(current)) {
      const finalQuasis = addTemplateQuasi(quasis, currentStr);
      return { quasis: finalQuasis, finalCurrent: current };
    }
    const char = getChar(current);

    if (char === '$' && getPeek(current) === '{') {
      const {
        newCurrent,
        newStr,
        quasis: updatedQuasis,
      } = handleInterpolationStart(current, currentStr, quasis);
      const { exprContent, current: afterExpr } = parseInterpolation(newCurrent);
      const exprQuasi: TemplateQuasi = { type: 'expression', value: exprContent.trim() };
      const quasisWithExpr: TemplateQuasi[] = [...updatedQuasis, exprQuasi];
      return scan(afterExpr, newStr, quasisWithExpr);
    }

    if (char === '`') {
      const { finalCurrent, quasis: finalQuasis } = finalizeTemplateLiteral(
        current,
        currentStr,
        quasis
      );
      return { quasis: finalQuasis, finalCurrent };
    }

    const { newCurrent, newStr } = consumeTemplateContent(current, currentStr);
    return scan(newCurrent, newStr, quasis);
  };
  return scan(initialCurrent, '', []);
};

export const tokenizeTemplateLiteral: Tokenizer = (state) => {
  if (getChar(state) !== '`') {
    return null;
  }

  const initialCurrent = advance(state);
  const { quasis, finalCurrent } = consumeTemplateLoop(initialCurrent);

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

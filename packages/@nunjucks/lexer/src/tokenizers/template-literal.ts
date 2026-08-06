import type { Tokenizer, LexerState } from '../types.ts';
import { getChar, getPeek, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

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

const processInterpolationChar = (exprChar: string, exprDepth: number): { depthDelta: number; charToAdd: string } | null => {
  if (exprChar === '{') {
    return { depthDelta: 1, charToAdd: exprChar };
  }
  if (exprChar === '}') {
    return { depthDelta: -1, charToAdd: exprChar };
  }
  if (isBacktickInExpression(exprChar, exprDepth)) {
    throw new Error('Unexpected backtick in template expression');
  }
  return { depthDelta: 0, charToAdd: exprChar };
};

const parseInterpolation = (current: LexerState): ParseInterpolationResult => {
  let exprDepth = 1;
  let exprContent = '';
  let pos = current;

  while (!isFinished(pos) && exprDepth > 0) {
    const exprChar = getChar(pos);
    const result = processInterpolationChar(exprChar, exprDepth);
    if (result) {
      exprDepth += result.depthDelta;
      if (result.depthDelta === 0 || exprDepth > 0) {
        exprContent += result.charToAdd;
      }
    }
    pos = advance(pos);
  }

  return { exprContent, current: pos };
};

const pushTemplateQuasi = (
  quasis: TemplateQuasi[],
  currentStr: string
): void => {
  if (currentStr) {
    quasis.push({ type: 'template', value: currentStr });
  }
};

const handleInterpolationStart = (
  current: LexerState,
  currentStr: string,
  quasis: TemplateQuasi[]
): { newCurrent: LexerState; newStr: string } => {
  pushTemplateQuasi(quasis, currentStr);
  const newCurrent = advance(current, 2);
  return { newCurrent, newStr: '' };
};

const finalizeTemplateLiteral = (
  current: LexerState,
  currentStr: string,
  quasis: TemplateQuasi[]
): LexerState => {
  pushTemplateQuasi(quasis, currentStr);
  return advance(current);
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
  let current = initialCurrent;
  let currentStr = '';
  const quasis: TemplateQuasi[] = [];

  while (!isFinished(current)) {
    const char = getChar(current);

    if (char === '$' && getPeek(current) === '{') {
      const { newCurrent, newStr } = handleInterpolationStart(current, currentStr, quasis);
      current = newCurrent;
      currentStr = newStr;

      const { exprContent, current: afterExpr } = parseInterpolation(current);
      quasis.push({ type: 'expression', value: exprContent.trim() });
      current = afterExpr;
      continue;
    }

    if (char === '`') {
      current = finalizeTemplateLiteral(current, currentStr, quasis);
      break;
    }

    const { newCurrent, newStr } = consumeTemplateContent(current, currentStr);
    current = newCurrent;
    currentStr = newStr;
  }

  return { quasis, finalCurrent: current };
};

export const tokenizeTemplateLiteral: Tokenizer = (state) => {
  if (getChar(state) !== '`') { return null; }

  const initialCurrent = advance(state);
  const { quasis, finalCurrent } = consumeTemplateLoop(initialCurrent);

  return {
    token: createToken(
      'template-literal' as TokenType,
      { quasis, expressions: [] },
      state.lineno,
      state.colno
    ),
    state: finalCurrent,
  };
};

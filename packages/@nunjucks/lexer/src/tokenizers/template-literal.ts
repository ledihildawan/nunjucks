import type { Tokenizer, LexerState } from '../types.ts';
import { getChar, getPeek, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_TEMPLATE_LITERAL } from '../token-types.ts';

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
  const scan = (pos: LexerState, exprDepth: number, exprContent: string): ParseInterpolationResult => {
    if (isFinished(pos) || exprDepth <= 0) { return { exprContent, current: pos }; }
    const exprChar = getChar(pos);
    const result = processInterpolationChar(exprChar, exprDepth);
    if (result) {
      const newDepth = exprDepth + result.depthDelta;
      const newContent = (result.depthDelta === 0 || newDepth > 0) ? exprContent + result.charToAdd : exprContent;
      return scan(advance(pos), newDepth, newContent);
    }
    return scan(advance(pos), exprDepth, exprContent);
  };
  return scan(current, 1, '');
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
  const scan = (
    current: LexerState,
    currentStr: string,
    quasis: TemplateQuasi[]
  ): { quasis: TemplateQuasi[]; finalCurrent: LexerState } => {
    if (isFinished(current)) { return { quasis, finalCurrent: current }; }
    const char = getChar(current);

    if (char === '$' && getPeek(current) === '{') {
      const { newCurrent, newStr } = handleInterpolationStart(current, currentStr, quasis);
      const { exprContent, current: afterExpr } = parseInterpolation(newCurrent);
      quasis.push({ type: 'expression', value: exprContent.trim() });
      return scan(afterExpr, newStr, quasis);
    }

    if (char === '`') {
      const finalized = finalizeTemplateLiteral(current, currentStr, quasis);
      return { quasis, finalCurrent: finalized };
    }

    const { newCurrent, newStr } = consumeTemplateContent(current, currentStr);
    return scan(newCurrent, newStr, quasis);
  };
  return scan(initialCurrent, '', []);
};

export const tokenizeTemplateLiteral: Tokenizer = (state) => {
  if (getChar(state) !== '`') { return null; }

  const initialCurrent = advance(state);
  const { quasis, finalCurrent } = consumeTemplateLoop(initialCurrent);

  return {
    token: createToken(
      TOKEN_TEMPLATE_LITERAL,
      { quasis, expressions: [] },
      state.lineno,
      state.colno
    ),
    state: finalCurrent,
  };
};

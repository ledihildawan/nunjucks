// ============================================
// FP-Style Lexer - Simplified Type Definitions
// ============================================

import type { Token, TokenType, TokenValue } from './token-types';
import {
  WHITESPACE_CHARS,
  DELIM_CHARS,
  INT_CHARS,
  COMPLEX_OPERATORS,
  createDelimiters,
  type Delimiters,
  type ComplexOperator,
} from './delimiters';

// ============================================
// State Interface
// ============================================

export interface LexerState {
  str: string;
  index: number;
  lineno: number;
  colno: number;
  inCode: boolean;
  tags: Delimiters;
  trimBlocks: boolean;
  lstripBlocks: boolean;
}

export interface LexerOptions {
  tags?: Partial<Delimiters>;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
}

// ============================================
// Token Creation (Pure Functions)
// ============================================

export const createToken = (type: TokenType, value: TokenValue, lineno: number, colno: number): Token => ({
  type,
  value,
  lineno,
  colno,
});

export const createOperatorToken = (value: string, lineno: number, colno: number): Token =>
  createToken('operator' as TokenType, value, lineno, colno);

export const createNumberToken = (value: number, lineno: number, colno: number, hasDecimal: boolean): Token =>
  createToken(hasDecimal ? 'float' as TokenType : 'int' as TokenType, value, lineno, colno);

// ============================================
// State Helpers
// ============================================

export const createState = (str: string, opts: LexerOptions = {}): LexerState => ({
  str,
  index: 0,
  lineno: 0,
  colno: 0,
  inCode: false,
  tags: createDelimiters(opts.tags),
  trimBlocks: Boolean(opts.trimBlocks),
  lstripBlocks: Boolean(opts.lstripBlocks),
});

export const getChar = (state: LexerState): string =>
  state.index < state.str.length ? state.str[state.index] : '';

export const getPeek = (state: LexerState): string =>
  state.index + 1 < state.str.length ? state.str[state.index + 1] : '';

export const isFinished = (state: LexerState): boolean =>
  state.index >= state.str.length;

export const advance = (state: LexerState, n: number = 1): LexerState => {
  let { index, lineno, colno } = state;
  for (let i = 0; i < n && index < state.str.length; i++) {
    const prev = index > 0 ? state.str[index - 1] : '';
    if (prev === '\n') {
      lineno++;
      colno = 0;
    } else {
      colno++;
    }
    index++;
  }
  return { ...state, index, lineno, colno };
};

export const matches = (state: LexerState, text: string): boolean =>
  state.str.slice(state.index, state.index + text.length) === text;

// ============================================
// Validators (Pure Functions)
// ============================================

const isComplexOperator = (str: string): boolean => (COMPLEX_OPERATORS as readonly string[]).includes(str);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isNumericString = (str: string): boolean =>
  str.length > 0 && str.split('').every(isDigit);

const isBooleanString = (str: string): boolean =>
  str === 'true' || str === 'false';

const isNullString = (str: string): boolean =>
  str === 'none' || str === 'null';

// ============================================
// String Parsers (Pure Functions)
// ============================================

const extractWhile = (str: string, start: number, chars: string): string => {
  let end = start;
  while (end < str.length && chars.includes(str[end])) end++;
  return str.slice(start, end);
};

const extractUntil = (str: string, start: number, chars: string): string => {
  let end = start;
  while (end < str.length && !chars.includes(str[end])) end++;
  return str.slice(start, end);
};

const parseStringContent = (str: string, start: number, quote: string): string => {
  let end = start;
  while (end < str.length && str[end] !== quote) {
    if (str[end] === '\\' && end + 1 < str.length) end++;
    end++;
  }
  return str.slice(start, end);
};

// ============================================
// Tokenizers (Pure Functions Returning Results)
// ============================================

export interface TokenizeResult {
  token: Token;
  state: LexerState;
}

type Tokenizer = (state: LexerState) => TokenizeResult | null;

const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile(state.str, state.index, WHITESPACE_CHARS);
  if (!ws) return null;
  return { token: createToken('whitespace' as TokenType, ws, state.lineno, state.colno), state: advance(state, ws.length) };
};

const tokenizeNumber: Tokenizer = (state) => {
  let num = '';
  let hasDecimal = false;
  let current = state;
  
  while (current.index < current.str.length && isDigit(current.str[current.index])) {
    num += current.str[current.index];
    current = advance(current);
  }
  
  if (current.index < current.str.length && current.str[current.index] === '.') {
    hasDecimal = true;
    num += '.';
    current = advance(current);
    while (current.index < current.str.length && isDigit(current.str[current.index])) {
      num += current.str[current.index];
      current = advance(current);
    }
  }
  
  if (!num || (num === '.' && !hasDecimal)) return null;
  
  const value = hasDecimal ? parseFloat(num) : parseInt(num, 10);
  return { token: createNumberToken(value, current.lineno, current.colno, hasDecimal), state: current };
};

const tokenizeString: Tokenizer = (state) => {
  const char = getChar(state);
  if (char !== '"' && char !== "'") return null;
  
  const quote = char;
  let current = advance(state);
  const content = parseStringContent(current.str, current.index, quote);
  current = advance(current, content.length + 1);
  
  return { token: createToken('string' as TokenType, content, current.lineno, current.colno), state: current };
};

const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil(state.str, state.index, WHITESPACE_CHARS + DELIM_CHARS);
  if (!sym) return null;
  
  let current = advance(state, sym.length);
  
  if (isNumericString(sym)) {
    return { token: createNumberToken(parseInt(sym, 10), current.lineno, current.colno, false), state: current };
  }
  
  let type: TokenType = 'symbol' as TokenType;
  if (isBooleanString(sym)) type = 'boolean' as TokenType;
  else if (isNullString(sym)) type = 'none' as TokenType;
  
  return { token: createToken(type, sym, current.lineno, current.colno), state: current };
};

const tokenizeOperator: Tokenizer = (state) => {
  const char = getChar(state);
  if (!DELIM_CHARS.includes(char)) return null;
  
  let op = char;
  let current = advance(state);
  
  const twoChar = char + getPeek(current);
  if (isComplexOperator(twoChar)) {
    op = twoChar;
    current = advance(current);
    
    const threeChar = twoChar + getPeek(current);
    if (isComplexOperator(threeChar)) {
      op = threeChar;
      current = advance(current);
    }
  }
  
  let type: TokenType = 'operator' as TokenType;
  if (op === '|>') type = 'pipe-forward' as TokenType;
  else if (op === '...') type = 'spread' as TokenType;
  
  return { token: createToken(type, op, state.lineno, state.colno), state: current };
};

const tokenizeBlockStart: Tokenizer = (state) => {
  if (!matches(state, state.tags.BLOCK_START)) return null;
  return {
    token: createToken('block-start' as TokenType, state.tags.BLOCK_START, state.lineno, state.colno),
    state: advance(state, state.tags.BLOCK_START.length),
  };
};

const tokenizeBlockEnd: Tokenizer = (state) => {
  if (!matches(state, state.tags.BLOCK_END)) return null;
  return {
    token: createToken('block-end' as TokenType, state.tags.BLOCK_END, state.lineno, state.colno),
    state: advance(state, state.tags.BLOCK_END.length),
  };
};

const tokenizeVariableStart: Tokenizer = (state) => {
  if (!matches(state, state.tags.VARIABLE_START)) return null;
  return {
    token: createToken('variable-start' as TokenType, state.tags.VARIABLE_START, state.lineno, state.colno),
    state: advance(state, state.tags.VARIABLE_START.length),
  };
};

const tokenizeVariableEnd: Tokenizer = (state) => {
  if (!matches(state, state.tags.VARIABLE_END)) return null;
  return {
    token: createToken('variable-end' as TokenType, state.tags.VARIABLE_END, state.lineno, state.colno),
    state: advance(state, state.tags.VARIABLE_END.length),
  };
};

const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) return null;
  
  let text = '';
  let current = state;
  
  while (current.index < current.str.length) {
    const char = getChar(current);
    
    if (matches(current, current.tags.BLOCK_START) || matches(current, current.tags.VARIABLE_START)) {
      break;
    }
    
    text += char;
    current = advance(current);
  }
  
  if (!text) return null;
  return { token: createToken('data' as TokenType, text, current.lineno, current.colno), state: current };
};

// ============================================
// Combinators
// ============================================

const or = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) return result;
  }
  return null;
};

// ============================================
// Main Tokenizer
// ============================================

const templateTokenizers = or(
  tokenizeBlockStart,
  tokenizeVariableStart,
  tokenizeTemplateText,
);

const codeTokenizers = or(
  tokenizeString,
  tokenizeWhitespace,
  tokenizeBlockEnd,
  tokenizeVariableEnd,
  tokenizeNumber,
  tokenizeSymbol,
  tokenizeOperator,
);

const tokenizers = (state: LexerState): TokenizeResult | null => {
  if (state.inCode) {
    return codeTokenizers(state);
  }
  return templateTokenizers(state);
};

export function* lex(src: string, opts: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, opts);
  
  while (state.index < state.str.length) {
    const result = tokenizers(state);
    
    if (!result) {
      state = advance(state);
      continue;
    }
    
    yield result.token;
    state = result.state;
    
    // Track mode changes
    const tokenType = result.token.type as string;
    if (tokenType === 'block-start' || tokenType === 'variable-start') {
      state = { ...state, inCode: true };
    } else if (tokenType === 'block-end' || tokenType === 'variable-end') {
      state = { ...state, inCode: false };
    }
  }
}

export function createTokenizer(src: string, opts: LexerOptions = {}) {
  const generator = lex(src, opts);
  
  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) return null;
      return result.value;
    },
  };
}

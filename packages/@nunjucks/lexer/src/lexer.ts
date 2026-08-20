import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import { WHITESPACE_CHAR_SET } from './constants.ts';
import { createDelimiters } from './delimiters.ts';
import { advance, createState, getChar } from './state.ts';
import type { Token } from './token-types.ts';
import { tokenizers } from './tokenizers/index.ts';
import type { LexerOptions, LexerState } from './types.ts';

const updateCodeState = (tokenType: string, state: LexerState): LexerState => {
  if (tokenType === 'block-start' || tokenType === 'variable-start') {
    return { ...state, inCode: true };
  }
  if (tokenType === 'block-end' || tokenType === 'variable-end') {
    return { ...state, inCode: false };
  }
  return state;
};

const processTokenizerResult = (result: { token: Token; state: LexerState }): LexerState => {
  const state = result.state;
  return updateCodeState(result.token.type, state);
};

const handleUnexpectedChar = (state: LexerState): never => {
  const char = getChar(state);
  throw createLog('error', {
    def: {
      name: 'UNEXPECTED_CHAR',
      message: () => `Unexpected character '${char}' at line ${state.lineno}:${state.colno}`,
      pattern: MATCH_ANY_RE,
    },
    params: { char },
    subject: char,
    context: { lineno: state.lineno, colno: state.colno, phase: 'parse', lineBase: 'zero' },
  });
};

const isWhitespace = (char: string | null): boolean =>
  char !== null && WHITESPACE_CHAR_SET.has(char);

// WHY: single lazily-yielding generator (low memory footprint on large template sources)
// driven by an internal while loop — the previous per-token `yield*` self-delegation built
// a delegation chain one frame per token, making every next() traverse O(n) frames
// (O(n²) total) and growing the native stack O(n). Loop exemption: lexer/tokenizer engine
// (high-throughput scanner).
const lexGenerator = function* (state: LexerState): Generator<Token, void, unknown> {
  let current = state;
  while (current.index < current.source.length) {
    const result = tokenizers(current);
    if (result) {
      yield result.token;
      current = processTokenizerResult(result);
      continue;
    }
    const char = getChar(current);
    if (char && !isWhitespace(char)) {
      handleUnexpectedChar(current);
    }
    current = advance(current);
  }
};

// WHY: throwing contract — nextToken signals lexical errors by THROWING branded
// TemplateErrors (createLog); the Result conversion is owned by the parser boundary
// (parser/parse.ts maps isTemplateError to err, all other throws propagate as bugs).
// Direct consumers of createTokenizer must apply the same mapping.
interface TokenizerResult {
  nextToken: () => Token | null;
  tags: ReturnType<typeof createDelimiters>;
}

/**
 * Creates the pull-based tokenizer over `src`: `nextToken` yields tokens lazily and
 * returns `null` at EOF; lexical errors surface as thrown branded `TemplateError`s,
 * leaving Result conversion to the parser boundary.
 */
export const createTokenizer = (src: string, options: LexerOptions = {}): TokenizerResult => {
  const generator = lexGenerator(createState(src, options));
  const tags = createDelimiters(options.tags);

  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) {
        return null;
      }
      return result.value;
    },
    tags,
  };
};

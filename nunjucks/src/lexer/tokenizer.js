import { createTemplateError } from '../error/index.js';
import {
  TOKEN_STRING,
  TOKEN_WHITESPACE,
  TOKEN_DATA,
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_CURLY,
  TOKEN_OPERATOR,
  TOKEN_COMMA,
  TOKEN_COLON,
  TOKEN_TILDE,
  TOKEN_PIPEFORWARD,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_SYMBOL,
  TOKEN_REGEX,
} from './token-types.js';
import {
  WHITESPACE_CHARS,
  DELIM_CHARS,
  INT_CHARS,
  COMPLEX_OPERATORS,
  REGEX_FLAGS,
  createDelimiters,
} from './delimiters.js';

export const createToken = (type, value, lineno, colno) => ({
  type,
  value,
  lineno,
  colno,
});

export function createTokenizer(str, opts = {}) {
  const state = {
    str,
    index: 0,
    len: str.length,
    lineno: 0,
    colno: 0,
    in_code: false,
    tags: createDelimiters(opts.tags),
    trimBlocks: !!opts.trimBlocks,
    lstripBlocks: !!opts.lstripBlocks
  };

  const api = {
    get str() { return state.str; },
    get index() { return state.index; },
    set index(val) { state.index = val; },
    get len() { return state.len; },
    get lineno() { return state.lineno; },
    set lineno(val) { state.lineno = val; },
    get colno() { return state.colno; },
    set colno(val) { state.colno = val; },
    get in_code() { return state.in_code; },
    set in_code(val) { state.in_code = val; },
    get tags() { return state.tags; },
    get trimBlocks() { return state.trimBlocks; },
    get lstripBlocks() { return state.lstripBlocks; },

    current() {
      if (!api.isFinished()) {
        return state.str.charAt(state.index);
      }
      return '';
    },

    previous() {
      return state.str.charAt(state.index - 1);
    },

    currentStr() {
      if (!api.isFinished()) {
        return state.str.substr(state.index);
      }
      return '';
    },

    isFinished() {
      return state.index >= state.len;
    },

    forward() {
      state.index++;
      if (api.previous() === '\n') {
        state.lineno++;
        state.colno = 0;
      } else {
        state.colno++;
      }
    },

    back() {
      state.index--;
      if (api.current() === '\n') {
        state.lineno--;
        const idx = state.str.lastIndexOf('\n', state.index - 1);
        state.colno = idx === -1 ? state.index : state.index - idx;
      } else {
        state.colno--;
      }
    },

    forwardN(n) {
      for (let i = 0; i < n; i++) {
        api.forward();
      }
    },

    backN(n) {
      for (let i = 0; i < n; i++) {
        api.back();
      }
    },

    _matches(str) {
      if (state.index + str.length > state.len) {
        return null;
      }
      return state.str.slice(state.index, state.index + str.length) === str;
    },

    _extractString(str) {
      if (api._matches(str)) {
        api.forwardN(str.length);
        return str;
      }
      return null;
    },

    _extractMatching(breakOnMatch, charString) {
      if (api.isFinished()) {
        return null;
      }

      let first = charString.indexOf(api.current());
      if ((breakOnMatch && first === -1) || (!breakOnMatch && first !== -1)) {
        let t = api.current();
        api.forward();
        let idx = charString.indexOf(api.current());
        while (((breakOnMatch && idx === -1) || (!breakOnMatch && idx !== -1)) && !api.isFinished()) {
          t += api.current();
          api.forward();
          idx = charString.indexOf(api.current());
        }
        return t;
      }
      return '';
    },

    _extractUntil(charString) {
      return api._extractMatching(true, charString || '');
    },

    _extract(charString) {
      return api._extractMatching(false, charString);
    },

    _parseString(delimiter) {
      api.forward();
      let str = '';
      while (!api.isFinished() && api.current() !== delimiter) {
        let cur = api.current();
        if (cur === '\\') {
          api.forward();
          switch (api.current()) {
            case 'n': str += '\n'; break;
            case 't': str += '\t'; break;
            case 'r': str += '\r'; break;
            default: str += api.current();
          }
          api.forward();
        } else {
          str += cur;
          api.forward();
        }
      }
      api.forward();
      return str;
    },

    _extractRegex(regex) {
      const matches = api.currentStr().match(regex);
      if (!matches) return null;
      api.forwardN(matches[0].length);
      return matches;
    },

    _parseOperator(cur, lineno, colno) {
      let complexCur = cur + api.current();
      if (COMPLEX_OPERATORS.indexOf(complexCur) !== -1) {
        api.forward();
        cur = complexCur;
        if (COMPLEX_OPERATORS.indexOf(complexCur + api.current()) !== -1) {
          cur = complexCur + api.current();
          api.forward();
        }
      }

      switch (cur) {
        case '(': return createToken(TOKEN_LEFT_PAREN, cur, lineno, colno);
        case ')': return createToken(TOKEN_RIGHT_PAREN, cur, lineno, colno);
        case '[': return createToken(TOKEN_LEFT_BRACKET, cur, lineno, colno);
        case ']': return createToken(TOKEN_RIGHT_BRACKET, cur, lineno, colno);
        case '{': return createToken(TOKEN_LEFT_CURLY, cur, lineno, colno);
        case '}': return createToken(TOKEN_RIGHT_CURLY, cur, lineno, colno);
        case ',': return createToken(TOKEN_COMMA, cur, lineno, colno);
        case ':': return createToken(TOKEN_COLON, cur, lineno, colno);
        case '~': return createToken(TOKEN_TILDE, cur, lineno, colno);
        case '|>': return createToken(TOKEN_PIPEFORWARD, cur, lineno, colno);
        default: return createToken(TOKEN_OPERATOR, cur, lineno, colno);
      }
    },

    _parseNumber(tok, lineno, colno) {
      if (api.current() === '.') {
        api.forward();
        let dec = api._extract(INT_CHARS);
        return createToken(TOKEN_FLOAT, tok + '.' + dec, lineno, colno);
      }
      return createToken(TOKEN_INT, tok, lineno, colno);
    },

    _parseSymbol(tok, lineno, colno) {
      if (tok.match(/^[-+]?[0-9]+$/)) {
        return api._parseNumber(tok, lineno, colno);
      } else if (tok.match(/^(true|false)$/)) {
        return createToken(TOKEN_BOOLEAN, tok, lineno, colno);
      } else if (tok === 'none' || tok === 'null') {
        return createToken(TOKEN_NONE, tok, lineno, colno);
      } else if (tok) {
        return createToken(TOKEN_SYMBOL, tok, lineno, colno);
      }
      throw createTemplateError('Unexpected value while parsing: ' + tok, state.lineno, state.colno, { phase: 'lex' });
    },

    _handleTrimBlocks(trimFunc) {
      let cur = api.current();
      if (cur === '\n') {
        api.forward();
      } else if (cur === '\r') {
        api.forward();
        cur = api.current();
        if (cur === '\n') {
          api.forward();
        } else {
          api.back();
        }
      }
    },

    nextToken() {
      let lineno = state.lineno;
      let colno = state.colno;
      let tok;

      if (state.in_code) {
        if (api.isFinished()) {
          return null;
        }

        let cur = api.current();

        if (cur === '"' || cur === '\'') {
          return createToken(TOKEN_STRING, api._parseString(cur), lineno, colno);
        } else if ((tok = api._extract(WHITESPACE_CHARS))) {
          return createToken(TOKEN_WHITESPACE, tok, lineno, colno);
        } else if ((tok = api._extractString(state.tags.BLOCK_END)) ||
          (tok = api._extractString('-' + state.tags.BLOCK_END))) {
          state.in_code = false;
          if (state.trimBlocks) {
            api._handleTrimBlocks();
          }
          return createToken(TOKEN_BLOCK_END, tok, lineno, colno);
        } else if ((tok = api._extractString(state.tags.VARIABLE_END)) ||
          (tok = api._extractString('-' + state.tags.VARIABLE_END))) {
          state.in_code = false;
          return createToken(TOKEN_VARIABLE_END, tok, lineno, colno);
        } else if (cur === 'r' && state.str.charAt(state.index + 1) === '/') {
          return api._parseRegex(lineno, colno);
        } else if (DELIM_CHARS.indexOf(cur) !== -1) {
          api.forward();
          return api._parseOperator(cur, lineno, colno);
        } else {
          tok = api._extractUntil(WHITESPACE_CHARS + DELIM_CHARS);
          return api._parseSymbol(tok, lineno, colno);
        }
      } else {
        return api._parseTemplateText(lineno, colno);
      }
    },

    _parseRegex(lineno, colno) {
      api.forwardN(2);
      let regexBody = '';
      while (!api.isFinished()) {
        if (api.current() === '/' && api.previous() !== '\\') {
          api.forward();
          break;
        }
        regexBody += api.current();
        api.forward();
      }

      let regexFlags = '';
      while (!api.isFinished()) {
        if (REGEX_FLAGS.indexOf(api.current()) !== -1) {
          regexFlags += api.current();
          api.forward();
        } else {
          break;
        }
      }

      return createToken(TOKEN_REGEX, { body: regexBody, flags: regexFlags }, lineno, colno);
    },

    _parseTemplateText(lineno, colno) {
      let beginChars = (
        state.tags.BLOCK_START.charAt(0) +
        state.tags.VARIABLE_START.charAt(0) +
        state.tags.COMMENT_START.charAt(0) +
        state.tags.COMMENT_END.charAt(0)
      );

      if (api.isFinished()) {
        return null;
      }

      let tok;
      if ((tok = api._extractString(state.tags.BLOCK_START + '-')) ||
        (tok = api._extractString(state.tags.BLOCK_START))) {
        state.in_code = true;
        return createToken(TOKEN_BLOCK_START, tok, lineno, colno);
      }

      if ((tok = api._extractString(state.tags.VARIABLE_START + '-')) ||
        (tok = api._extractString(state.tags.VARIABLE_START))) {
        state.in_code = true;
        return createToken(TOKEN_VARIABLE_START, tok, lineno, colno);
      }

      tok = '';
      let data;
      let inComment = false;

      if (api._matches(state.tags.COMMENT_START)) {
        inComment = true;
        tok = api._extractString(state.tags.COMMENT_START);
      }

      while ((data = api._extractUntil(beginChars)) !== null) {
        tok += data;

        if ((api._matches(state.tags.BLOCK_START) ||
          api._matches(state.tags.VARIABLE_START) ||
          api._matches(state.tags.COMMENT_START)) && !inComment) {
          if (state.lstripBlocks &&
            api._matches(state.tags.BLOCK_START) &&
            state.colno > 0 &&
            state.colno <= tok.length) {
            let lastLine = tok.slice(-state.colno);
            if (/^\s+$/.test(lastLine)) {
              tok = tok.slice(0, -state.colno);
              if (!tok.length) {
                return api.nextToken();
              }
            }
          }
          break;
        } else if (api._matches(state.tags.COMMENT_END)) {
          if (!inComment) {
            throw createTemplateError('unexpected end of comment', state.lineno, state.colno, { phase: 'lex' });
          }
          tok += api._extractString(state.tags.COMMENT_END);
          break;
        } else if (api._matches(state.tags.BLOCK_END)) {
          state.in_code = true;
          break;
        } else if (api.current() === '%' && api.peek && api.peek() === '}') {
          api.forward();
          api.forward();
          state.in_code = true;
          break;
        } else {
          tok += api.current();
          api.forward();
        }
      }

      if (data === null && inComment) {
        throw createTemplateError('expected end of comment, got end of file', state.lineno, state.colno, { phase: 'lex' });
      }

      return createToken(inComment ? TOKEN_COMMENT : TOKEN_DATA, tok, lineno, colno);
    },

    peek() {
      if (state.index + 1 < state.len) {
        return state.str.charAt(state.index + 1);
      }
      return '';
    }
  };

  return api;
}

export function lex(src, opts) {
  return createTokenizer(src, opts);
}

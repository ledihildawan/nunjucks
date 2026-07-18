import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import {
  TOKEN_STRING,
  TOKEN_WHITESPACE,
  TOKEN_DATA,
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
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
import { createToken, createOperatorToken, createNumberToken, createSymbolToken } from './tokenizer-token-creators.js';
import { isComplexOperator, isValidRegexFlag, isNumericString, isBooleanString, isNullString } from './tokenizer-validators.js';
import { extractWhileInCharSet, extractUntilCharSet, parseStringContent, parseRegexContent } from './tokenizer-string-parsers.js';

export { createToken };

export function createTokenizer(str, opts = {}) {
  const state = {
    str,
    index: 0,
    len: str.length,
    lineno: 0,
    colno: 0,
    in_code: false,
    tags: createDelimiters(opts.tags),
    trimBlocks: Boolean(opts.trimBlocks),
    lstripBlocks: Boolean(opts.lstripBlocks),
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
      return state.index >= state.len ? '' : state.str.charAt(state.index);
    },

    previous() {
      return state.index > 0 ? state.str.charAt(state.index - 1) : '';
    },

    currentStr() {
      return state.index >= state.len ? '' : state.str.substr(state.index);
    },

    isFinished() {
      return state.index >= state.len;
    },

    forward() {
      state.index++;
      if (this.previous() === '\n') {
        state.lineno++;
        state.colno = 0;
      } else {
        state.colno++;
      }
    },

    back() {
      state.index--;
      if (this.current() === '\n') {
        state.lineno--;
        const idx = state.str.lastIndexOf('\n', state.index - 1);
        state.colno = idx === -1 ? state.index : state.index - idx;
      } else {
        state.colno--;
      }
    },

    forwardN(n) {
      for (let i = 0; i < n; i++) this.forward();
    },

    backN(n) {
      for (let i = 0; i < n; i++) this.back();
    },

    peek() {
      return state.index + 1 < state.len ? state.str.charAt(state.index + 1) : '';
    },

    _matches(target) {
      if (state.index + target.length > state.len) return null;
      return state.str.slice(state.index, state.index + target.length) === target;
    },

    _extractString(txt) {
      if (this._matches(txt)) {
        this.forwardN(txt.length);
        return txt;
      }
      return null;
    },

    _extractWhileIn(charSet) {
      const extracted = extractWhileInCharSet(state.str, state.index, charSet);
      this.forwardN(extracted.length);
      return extracted;
    },

    _extractUntil(charSet) {
      const extracted = extractUntilCharSet(state.str, state.index, charSet);
      this.forwardN(extracted.length);
      return extracted;
    },

    _extract(charSet) {
      return this._extractWhileIn(charSet);
    },

    _parseString(quote) {
      const content = parseStringContent(state.str, state.index + 1, quote);
      this.forwardN(content.length + 2);
      return content;
    },

    _parseOperator(cur, lineno, colno) {
      let op = cur;
      let next = this.current();
      if (next && isComplexOperator(cur + next, COMPLEX_OPERATORS)) {
        op = cur + next;
        this.forward();
        next = this.current();
        if (next && isComplexOperator(op + next, COMPLEX_OPERATORS)) {
          op = op + next;
          this.forward();
        }
      }
      return createOperatorToken(op, lineno, colno);
    },

    _parseNumber(tok, lineno, colno) {
      if (this.current() === '.') {
        this.forward();
        const dec = this._extractWhileIn(INT_CHARS);
        return createNumberToken(tok + '.' + dec, lineno, colno, true);
      }
      return createNumberToken(tok, lineno, colno, false);
    },

    _parseSymbol(tok, lineno, colno) {
      if (isNumericString(tok)) {
        return this._parseNumber(tok, lineno, colno);
      }
      const symbolToken = createSymbolToken(tok, lineno, colno, false, isBooleanString(tok), isNullString(tok));
      if (symbolToken) return symbolToken;
      throw createLog('error', ERROR_DEFINITIONS.PARSER_UNEXPECTED_TOKEN, { token: tok }, tok, { lineno: state.lineno, colno: state.colno, phase: 'lex', lineBase: 'zero' });
    },

    _parseRegex(lineno, colno) {
      this.forwardN(2);
      const { body, flags } = parseRegexContent(state.str, state.index, REGEX_FLAGS, isValidRegexFlag);
      this.forwardN(body.length + flags.length + 1);
      return createToken(TOKEN_REGEX, { body, flags }, lineno, colno);
    },

    _extractRegex(regex) {
      const matches = this.currentStr().match(regex);
      if (!matches) return null;
      this.forwardN(matches[0].length);
      return matches;
    },

    _handleTrimBlocks() {
      const cur = this.current();
      if (cur === '\n') {
        this.forward();
      } else if (cur === '\r') {
        this.forward();
        if (this.current() === '\n') {
          this.forward();
        } else {
          this.back();
        }
      }
    },

    _parseTemplateText(lineno, colno) {

      if (this.isFinished()) return null;

      const blockStart = this._extractString(state.tags.BLOCK_START + '-') || 
                         this._extractString(state.tags.BLOCK_START);
      if (blockStart) {
        state.in_code = true;
        return createToken(TOKEN_BLOCK_START, blockStart, lineno, colno);
      }

      const varStart = this._extractString(state.tags.VARIABLE_START + '-') || 
                       this._extractString(state.tags.VARIABLE_START);
      if (varStart) {
        state.in_code = true;
        return createToken(TOKEN_VARIABLE_START, varStart, lineno, colno);
      }

      let tok = '';
      let inComment = false;

      if (this._matches(state.tags.COMMENT_START)) {
        inComment = true;
        tok = this._extractString(state.tags.COMMENT_START);
      }

      while (!this.isFinished()) {
        if ((this._matches(state.tags.BLOCK_START) ||
             this._matches(state.tags.VARIABLE_START) ||
             this._matches(state.tags.COMMENT_START)) && !inComment) {
          if (state.lstripBlocks &&
              this._matches(state.tags.BLOCK_START) &&
              state.colno > 0 &&
              state.colno <= tok.length) {
            const lastLine = tok.slice(-state.colno);
            if (/^\s+$/.test(lastLine)) {
              tok = tok.slice(0, -state.colno);
              if (!tok.length) return this.nextToken();
            }
          }
          break;
        }

        if (this._matches(state.tags.COMMENT_END) && inComment) {
          tok += this._extractString(state.tags.COMMENT_END);
          break;
        }

        if (this._matches(state.tags.BLOCK_END)) {
          state.in_code = true;
          break;
        }

        if (this.current() === '%' && this.peek() === '}') {
          this.forward();
          this.forward();
          state.in_code = true;
          break;
        }

        tok += this.current();
        this.forward();
      }

      if (tok) {
        return createToken(inComment ? TOKEN_COMMENT : TOKEN_DATA, tok, lineno, colno);
      }

      return this.nextToken();
    },

    nextToken() {
      const lineno = state.lineno;
      const colno = state.colno;

      if (state.in_code) {
        return this._parseCodeToken(lineno, colno);
      }
      return this._parseTemplateText(lineno, colno);
    },

    _parseCodeToken(lineno, colno) {
      if (this.isFinished()) return null;

      const cur = this.current();

      if (cur === '"' || cur === '\'') {
        return createToken(TOKEN_STRING, this._parseString(cur), lineno, colno);
      }

      const ws = this._extractWhileIn(WHITESPACE_CHARS);
      if (ws) {
        return createToken(TOKEN_WHITESPACE, ws, lineno, colno);
      }

      const blockEnd = this._extractString(state.tags.BLOCK_END) || 
                       this._extractString('-' + state.tags.BLOCK_END);
      if (blockEnd) {
        state.in_code = false;
        if (state.trimBlocks) this._handleTrimBlocks();
        return createToken(TOKEN_BLOCK_END, blockEnd, lineno, colno);
      }

      const varEnd = this._extractString(state.tags.VARIABLE_END) || 
                     this._extractString('-' + state.tags.VARIABLE_END);
      if (varEnd) {
        state.in_code = false;
        return createToken(TOKEN_VARIABLE_END, varEnd, lineno, colno);
      }

      if (cur === 'r' && state.str.charAt(state.index + 1) === '/') {
        return this._parseRegex(lineno, colno);
      }

      if (DELIM_CHARS.includes(cur)) {
        this.forward();
        return this._parseOperator(cur, lineno, colno);
      }

      const symColno = state.colno;
      const sym = this._extractUntil(WHITESPACE_CHARS + DELIM_CHARS);
      return this._parseSymbol(sym, lineno, symColno);
    },
  };

  return api;
}

export function lex(src, opts) {
  return createTokenizer(src, opts);
}

import { TemplateError } from '../error/index.js';
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

export class Tokenizer {
  constructor(str, opts = {}) {
    this.str = str;
    this.index = 0;
    this.len = str.length;
    this.lineno = 0;
    this.colno = 0;
    this.in_code = false;
    this.tags = createDelimiters(opts.tags);
    this.trimBlocks = !!opts.trimBlocks;
    this.lstripBlocks = !!opts.lstripBlocks;
  }

  current() {
    if (!this.isFinished()) {
      return this.str.charAt(this.index);
    }
    return '';
  }

  previous() {
    return this.str.charAt(this.index - 1);
  }

  currentStr() {
    if (!this.isFinished()) {
      return this.str.substr(this.index);
    }
    return '';
  }

  isFinished() {
    return this.index >= this.len;
  }

  forward() {
    this.index++;
    if (this.previous() === '\n') {
      this.lineno++;
      this.colno = 0;
    } else {
      this.colno++;
    }
  }

  back() {
    this.index--;
    if (this.current() === '\n') {
      this.lineno--;
      let idx = this.str.lastIndexOf('\n', this.index - 1);
      this.colno = idx === -1 ? this.index : this.index - idx;
    } else {
      this.colno--;
    }
  }

  forwardN(n) {
    for (let i = 0; i < n; i++) {
      this.forward();
    }
  }

  backN(n) {
    for (let i = 0; i < n; i++) {
      this.back();
    }
  }

  _matches(str) {
    if (this.index + str.length > this.len) {
      return null;
    }
    return this.str.slice(this.index, this.index + str.length) === str;
  }

  _extractString(str) {
    if (this._matches(str)) {
      this.forwardN(str.length);
      return str;
    }
    return null;
  }

  _extractMatching(breakOnMatch, charString) {
    if (this.isFinished()) {
      return null;
    }

    let first = charString.indexOf(this.current());
    if ((breakOnMatch && first === -1) || (!breakOnMatch && first !== -1)) {
      let t = this.current();
      this.forward();
      let idx = charString.indexOf(this.current());
      while (((breakOnMatch && idx === -1) || (!breakOnMatch && idx !== -1)) && !this.isFinished()) {
        t += this.current();
        this.forward();
        idx = charString.indexOf(this.current());
      }
      return t;
    }
    return '';
  }

  _extractUntil(charString) {
    return this._extractMatching(true, charString || '');
  }

  _extract(charString) {
    return this._extractMatching(false, charString);
  }

  _parseString(delimiter) {
    this.forward();
    let str = '';
    while (!this.isFinished() && this.current() !== delimiter) {
      let cur = this.current();
      if (cur === '\\') {
        this.forward();
        switch (this.current()) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          default: str += this.current();
        }
        this.forward();
      } else {
        str += cur;
        this.forward();
      }
    }
    this.forward();
    return str;
  }

  _extractRegex(regex) {
    let matches = this.currentStr().match(regex);
    if (!matches) return null;
    this.forwardN(matches[0].length);
    return matches;
  }

  _parseOperator(cur, lineno, colno) {
    let complexCur = cur + this.current();
    if (COMPLEX_OPERATORS.indexOf(complexCur) !== -1) {
      this.forward();
      cur = complexCur;
      if (COMPLEX_OPERATORS.indexOf(complexCur + this.current()) !== -1) {
        cur = complexCur + this.current();
        this.forward();
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
  }

  _parseNumber(tok, lineno, colno) {
    if (this.current() === '.') {
      this.forward();
      let dec = this._extract(INT_CHARS);
      return createToken(TOKEN_FLOAT, tok + '.' + dec, lineno, colno);
    }
    return createToken(TOKEN_INT, tok, lineno, colno);
  }

  _parseSymbol(tok, lineno, colno) {
    if (tok.match(/^[-+]?[0-9]+$/)) {
      return this._parseNumber(tok, lineno, colno);
    } else if (tok.match(/^(true|false)$/)) {
      return createToken(TOKEN_BOOLEAN, tok, lineno, colno);
    } else if (tok === 'none' || tok === 'null') {
      return createToken(TOKEN_NONE, tok, lineno, colno);
    } else if (tok) {
      return createToken(TOKEN_SYMBOL, tok, lineno, colno);
    }
    throw new TemplateError('Unexpected value while parsing: ' + tok, this.lineno, this.colno, { phase: 'lex' });
  }

  _handleTrimBlocks(trimFunc) {
    let cur = this.current();
    if (cur === '\n') {
      this.forward();
    } else if (cur === '\r') {
      this.forward();
      cur = this.current();
      if (cur === '\n') {
        this.forward();
      } else {
        this.back();
      }
    }
  }

  nextToken() {
    let lineno = this.lineno;
    let colno = this.colno;
    let tok;

    if (this.in_code) {
      if (this.isFinished()) {
        return null;
      }

      let cur = this.current();

      if (cur === '"' || cur === '\'') {
        return createToken(TOKEN_STRING, this._parseString(cur), lineno, colno);
      } else if ((tok = this._extract(WHITESPACE_CHARS))) {
        return createToken(TOKEN_WHITESPACE, tok, lineno, colno);
      } else if ((tok = this._extractString(this.tags.BLOCK_END)) ||
        (tok = this._extractString('-' + this.tags.BLOCK_END))) {
        this.in_code = false;
        if (this.trimBlocks) {
          this._handleTrimBlocks();
        }
        return createToken(TOKEN_BLOCK_END, tok, lineno, colno);
      } else if ((tok = this._extractString(this.tags.VARIABLE_END)) ||
        (tok = this._extractString('-' + this.tags.VARIABLE_END))) {
        this.in_code = false;
        return createToken(TOKEN_VARIABLE_END, tok, lineno, colno);
      } else if (cur === 'r' && this.str.charAt(this.index + 1) === '/') {
        return this._parseRegex(lineno, colno);
      } else if (DELIM_CHARS.indexOf(cur) !== -1) {
        this.forward();
        return this._parseOperator(cur, lineno, colno);
      } else {
        tok = this._extractUntil(WHITESPACE_CHARS + DELIM_CHARS);
        return this._parseSymbol(tok, lineno, colno);
      }
    } else {
      return this._parseTemplateText(lineno, colno);
    }
  }

  _parseRegex(lineno, colno) {
    this.forwardN(2);
    let regexBody = '';
    while (!this.isFinished()) {
      if (this.current() === '/' && this.previous() !== '\\') {
        this.forward();
        break;
      }
      regexBody += this.current();
      this.forward();
    }

    let regexFlags = '';
    while (!this.isFinished()) {
      if (REGEX_FLAGS.indexOf(this.current()) !== -1) {
        regexFlags += this.current();
        this.forward();
      } else {
        break;
      }
    }

    return createToken(TOKEN_REGEX, { body: regexBody, flags: regexFlags }, lineno, colno);
  }

  _parseTemplateText(lineno, colno) {
    let beginChars = (
      this.tags.BLOCK_START.charAt(0) +
      this.tags.VARIABLE_START.charAt(0) +
      this.tags.COMMENT_START.charAt(0) +
      this.tags.COMMENT_END.charAt(0)
    );

    if (this.isFinished()) {
      return null;
    }

    let tok;
    if ((tok = this._extractString(this.tags.BLOCK_START + '-')) ||
      (tok = this._extractString(this.tags.BLOCK_START))) {
      this.in_code = true;
      return createToken(TOKEN_BLOCK_START, tok, lineno, colno);
    }

    if ((tok = this._extractString(this.tags.VARIABLE_START + '-')) ||
      (tok = this._extractString(this.tags.VARIABLE_START))) {
      this.in_code = true;
      return createToken(TOKEN_VARIABLE_START, tok, lineno, colno);
    }

    tok = '';
    let data;
    let inComment = false;

    if (this._matches(this.tags.COMMENT_START)) {
      inComment = true;
      tok = this._extractString(this.tags.COMMENT_START);
    }

    while ((data = this._extractUntil(beginChars)) !== null) {
      tok += data;

      if ((this._matches(this.tags.BLOCK_START) ||
        this._matches(this.tags.VARIABLE_START) ||
        this._matches(this.tags.COMMENT_START)) && !inComment) {
        if (this.lstripBlocks &&
          this._matches(this.tags.BLOCK_START) &&
          this.colno > 0 &&
          this.colno <= tok.length) {
          let lastLine = tok.slice(-this.colno);
          if (/^\s+$/.test(lastLine)) {
            tok = tok.slice(0, -this.colno);
            if (!tok.length) {
              return this.nextToken();
            }
          }
        }
        break;
      } else if (this._matches(this.tags.COMMENT_END)) {
        if (!inComment) {
          throw new TemplateError('unexpected end of comment', this.lineno, this.colno, { phase: 'lex' });
        }
        tok += this._extractString(this.tags.COMMENT_END);
        break;
      } else if (this._matches(this.tags.BLOCK_END)) {
        this.in_code = true;
        break;
      } else if (this.current() === '%' && this.peek() === '}') {
        this.forward();
        this.forward();
        this.in_code = true;
        break;
      } else {
        tok += this.current();
        this.forward();
      }
    }

    if (data === null && inComment) {
      throw new TemplateError('expected end of comment, got end of file', this.lineno, this.colno, { phase: 'lex' });
    }

    return createToken(inComment ? TOKEN_COMMENT : TOKEN_DATA, tok, lineno, colno);
  }
}

export function lex(src, opts) {
  return new Tokenizer(src, opts);
}

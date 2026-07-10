import { describe, test, expect } from 'bun:test';
import { Tokenizer, createToken, lex } from './tokenizer.js';
import {
  TOKEN_STRING, TOKEN_WHITESPACE, TOKEN_DATA, TOKEN_BLOCK_START, TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START, TOKEN_VARIABLE_END, TOKEN_COMMENT,
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY, TOKEN_RIGHT_CURLY, TOKEN_OPERATOR,
  TOKEN_COMMA, TOKEN_COLON, TOKEN_TILDE, TOKEN_PIPEFORWARD,
  TOKEN_INT, TOKEN_FLOAT, TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_SYMBOL, TOKEN_REGEX,
} from './token-types.js';

describe('createToken', () => {
  test('creates a token object', () => {
    const tok = createToken('TYPE', 'val', 1, 2);
    expect(tok).toEqual({ type: 'TYPE', value: 'val', lineno: 1, colno: 2 });
  });
});

describe('Tokenizer', () => {
  describe('constructor', () => {
    test('initializes with empty string', () => {
      const t = new Tokenizer('');
      expect(t.str).toBe('');
      expect(t.index).toBe(0);
      expect(t.len).toBe(0);
      expect(t.lineno).toBe(0);
      expect(t.colno).toBe(0);
      expect(t.in_code).toBe(false);
    });

    test('accepts custom tags', () => {
      const t = new Tokenizer('', { tags: { blockStart: '<%', blockEnd: '%>', variableStart: '${', variableEnd: '}' } });
      expect(t.tags.BLOCK_START).toBe('<%');
      expect(t.tags.BLOCK_END).toBe('%>');
      expect(t.tags.VARIABLE_START).toBe('${');
      expect(t.tags.VARIABLE_END).toBe('}');
    });

    test('respects trimBlocks option', () => {
      const t = new Tokenizer('', { trimBlocks: true });
      expect(t.trimBlocks).toBe(true);
    });

    test('respects lstripBlocks option', () => {
      const t = new Tokenizer('', { lstripBlocks: true });
      expect(t.lstripBlocks).toBe(true);
    });
  });

  describe('current', () => {
    test('returns current character', () => {
      const t = new Tokenizer('abc');
      expect(t.current()).toBe('a');
    });

    test('returns empty string when finished', () => {
      const t = new Tokenizer('');
      expect(t.current()).toBe('');
    });
  });

  describe('previous', () => {
    test('returns previous character', () => {
      const t = new Tokenizer('abc');
      t.index = 1;
      expect(t.previous()).toBe('a');
    });

    test('returns empty when at start', () => {
      const t = new Tokenizer('abc');
      expect(t.previous()).toBe('');
    });
  });

  describe('isFinished', () => {
    test('returns true when index >= len', () => {
      const t = new Tokenizer('');
      expect(t.isFinished()).toBe(true);
    });

    test('returns false when more chars remain', () => {
      const t = new Tokenizer('a');
      expect(t.isFinished()).toBe(false);
    });
  });

  describe('forward', () => {
    test('advances index and colno', () => {
      const t = new Tokenizer('abc');
      t.forward();
      expect(t.index).toBe(1);
      expect(t.colno).toBe(1);
    });

    test('increments lineno and resets colno on newline', () => {
      const t = new Tokenizer('a\nb');
      t.forward();
      expect(t.index).toBe(1);
      expect(t.colno).toBe(1);
      t.forward();
      expect(t.index).toBe(2);
      expect(t.lineno).toBe(1);
      expect(t.colno).toBe(0);
    });
  });

  describe('back', () => {
    test('decrements index and colno', () => {
      const t = new Tokenizer('abc');
      t.index = 2;
      t.colno = 2;
      t.back();
      expect(t.index).toBe(1);
      expect(t.colno).toBe(1);
    });

    test('decrements lineno and adjusts colno on newline', () => {
      const t = new Tokenizer('a\nb');
      t.index = 2;
      t.lineno = 1;
      t.back();
      expect(t.index).toBe(1);
      expect(t.lineno).toBe(0);
      expect(t.colno).toBe(1);
    });
  });

  describe('forwardN/backN', () => {
    test('forwardN advances by n', () => {
      const t = new Tokenizer('abcde');
      t.forwardN(3);
      expect(t.index).toBe(3);
    });

    test('backN goes back by n', () => {
      const t = new Tokenizer('abcde');
      t.index = 5;
      t.backN(2);
      expect(t.index).toBe(3);
    });
  });

  describe('_matches', () => {
    test('returns true when substring matches', () => {
      const t = new Tokenizer('hello world');
      expect(t._matches('hello')).toBe(true);
    });

    test('returns false when no match', () => {
      const t = new Tokenizer('hello');
      expect(t._matches('world')).toBe(false);
    });

    test('returns null when string extends past end', () => {
      const t = new Tokenizer('hi');
      expect(t._matches('hello')).toBe(null);
    });
  });

  describe('_extractString', () => {
    test('extracts matching string and advances', () => {
      const t = new Tokenizer('hello world');
      const result = t._extractString('hello');
      expect(result).toBe('hello');
      expect(t.index).toBe(5);
    });

    test('returns null when no match', () => {
      const t = new Tokenizer('hello');
      const result = t._extractString('world');
      expect(result).toBeNull();
      expect(t.index).toBe(0);
    });
  });

  describe('_extractUntil and _extract', () => {
    test('_extractUntil extracts until break char', () => {
      const t = new Tokenizer('abc def');
      const result = t._extractUntil(' ');
      expect(result).toBe('abc');
      expect(t.current()).toBe(' ');
    });

    test('_extract extracts matching chars', () => {
      const t = new Tokenizer('   abc');
      const result = t._extract(' ');
      expect(result).toBe('   ');
      expect(t.current()).toBe('a');
    });
  });

  describe('_parseString', () => {
    test('parses double-quoted string', () => {
      const t = new Tokenizer('"hello"');
      const result = t._parseString('"');
      expect(result).toBe('hello');
    });

    test('parses single-quoted string', () => {
      const t = new Tokenizer("'hello'");
      const result = t._parseString("'");
      expect(result).toBe('hello');
    });

    test('handles escape sequences', () => {
      const t = new Tokenizer('"a\\nb"');
      const result = t._parseString('"');
      expect(result).toBe('a\nb');
    });

    test('handles backslash escape', () => {
      const t = new Tokenizer('"a\\\\b"');
      const result = t._parseString('"');
      expect(result).toBe('a\\b');
    });
  });

  describe('_parseOperator', () => {
    test('returns LEFT_PAREN for (', () => {
      const t = new Tokenizer('(');
      const tok = t._parseOperator('(', 1, 1);
      expect(tok.type).toBe(TOKEN_LEFT_PAREN);
    });

    test('returns RIGHT_PAREN for )', () => {
      const t = new Tokenizer(')');
      const tok = t._parseOperator(')', 1, 1);
      expect(tok.type).toBe(TOKEN_RIGHT_PAREN);
    });

    test('returns LEFT_BRACKET for [', () => {
      const t = new Tokenizer('[');
      const tok = t._parseOperator('[', 1, 1);
      expect(tok.type).toBe(TOKEN_LEFT_BRACKET);
    });

    test('returns RIGHT_BRACKET for ]', () => {
      const t = new Tokenizer(']');
      const tok = t._parseOperator(']', 1, 1);
      expect(tok.type).toBe(TOKEN_RIGHT_BRACKET);
    });

    test('returns LEFT_CURLY for {', () => {
      const t = new Tokenizer('{');
      const tok = t._parseOperator('{', 1, 1);
      expect(tok.type).toBe(TOKEN_LEFT_CURLY);
    });

    test('returns RIGHT_CURLY for }', () => {
      const t = new Tokenizer('}');
      const tok = t._parseOperator('}', 1, 1);
      expect(tok.type).toBe(TOKEN_RIGHT_CURLY);
    });

    test('returns COMMA for ,', () => {
      const t = new Tokenizer(',');
      const tok = t._parseOperator(',', 1, 1);
      expect(tok.type).toBe(TOKEN_COMMA);
    });

    test('returns COLON for :', () => {
      const t = new Tokenizer(':');
      const tok = t._parseOperator(':', 1, 1);
      expect(tok.type).toBe(TOKEN_COLON);
    });

    test('returns TILDE for ~', () => {
      const t = new Tokenizer('~');
      const tok = t._parseOperator('~', 1, 1);
      expect(tok.type).toBe(TOKEN_TILDE);
    });

    test('returns PIPEFORWARD for |>', () => {
      const t = new Tokenizer('|>');
      t.forward();
      const tok = t._parseOperator('|', 1, 1);
      expect(tok.type).toBe(TOKEN_PIPEFORWARD);
      expect(tok.value).toBe('|>');
    });

    test('returns OPERATOR for other symbols', () => {
      const t = new Tokenizer('+');
      t.forward();
      const tok = t._parseOperator('+', 1, 1);
      expect(tok.type).toBe(TOKEN_OPERATOR);
      expect(tok.value).toBe('+');
    });

    test('handles complex operators like ==', () => {
      const t = new Tokenizer('== ');
      t.forward();
      const tok = t._parseOperator('=', 1, 1);
      expect(tok.type).toBe(TOKEN_OPERATOR);
      expect(tok.value).toBe('==');
    });

    test('handles triple operators like ===', () => {
      const t = new Tokenizer('===x');
      t.forward();
      const tok = t._parseOperator('=', 1, 1);
      expect(tok.value).toBe('===');
    });
  });

  describe('_parseSymbol', () => {
    test('parses integer', () => {
      const t = new Tokenizer('42');
      const tok = t._parseSymbol('42', 1, 1);
      expect(tok.type).toBe(TOKEN_INT);
      expect(tok.value).toBe('42');
    });

    test('parses negative integer', () => {
      const t = new Tokenizer('-5');
      const tok = t._parseSymbol('-5', 1, 1);
      expect(tok.type).toBe(TOKEN_INT);
      expect(tok.value).toBe('-5');
    });

    test('parses float via _parseNumber', () => {
      const t = new Tokenizer('3.14');
      t.forward();
      const tok = t._parseSymbol('3', 1, 1);
      expect(tok.type).toBe(TOKEN_FLOAT);
      expect(tok.value).toBe('3.14');
    });

    test('parses boolean true', () => {
      const t = new Tokenizer('');
      const tok = t._parseSymbol('true', 1, 1);
      expect(tok.type).toBe(TOKEN_BOOLEAN);
      expect(tok.value).toBe('true');
    });

    test('parses boolean false', () => {
      const t = new Tokenizer('');
      const tok = t._parseSymbol('false', 1, 1);
      expect(tok.type).toBe(TOKEN_BOOLEAN);
    });

    test('parses none', () => {
      const t = new Tokenizer('');
      const tok = t._parseSymbol('none', 1, 1);
      expect(tok.type).toBe(TOKEN_NONE);
    });

    test('parses null as none', () => {
      const t = new Tokenizer('');
      const tok = t._parseSymbol('null', 1, 1);
      expect(tok.type).toBe(TOKEN_NONE);
    });

    test('parses symbol', () => {
      const t = new Tokenizer('');
      const tok = t._parseSymbol('foo', 1, 1);
      expect(tok.type).toBe(TOKEN_SYMBOL);
      expect(tok.value).toBe('foo');
    });

    test('throws TemplateError for empty string', () => {
      const t = new Tokenizer('');
      expect(() => t._parseSymbol('', 1, 1)).toThrow();
    });
  });

  describe('nextToken in template text mode', () => {
    test('returns DATA token for plain text', () => {
      const t = new Tokenizer('hello');
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_DATA);
      expect(tok.value).toBe('hello');
    });

    test('returns BLOCK_START for block tag', () => {
      const t = new Tokenizer('{% foo %}');
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_BLOCK_START);
      expect(tok.value).toBe('{%');
    });

    test('returns VARIABLE_START for variable tag', () => {
      const t = new Tokenizer('{{ foo }}');
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_VARIABLE_START);
      expect(tok.value).toBe('{{');
    });

    test('returns null at end', () => {
      const t = new Tokenizer('');
      expect(t.nextToken()).toBeNull();
    });
  });

  describe('nextToken in code mode', () => {
    test('returns STRING token', () => {
      const t = new Tokenizer("'hello'");
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_STRING);
      expect(tok.value).toBe('hello');
    });

    test('returns WHITESPACE token', () => {
      const t = new Tokenizer('  foo');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_WHITESPACE);
      expect(tok.value).toBe('  ');
    });

    test('returns BLOCK_END token and exits code mode', () => {
      const t = new Tokenizer('%}');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_BLOCK_END);
      expect(t.in_code).toBe(false);
    });

    test('returns VARIABLE_END token and exits code mode', () => {
      const t = new Tokenizer('}}');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_VARIABLE_END);
      expect(t.in_code).toBe(false);
    });

    test('parses regex literal', () => {
      const t = new Tokenizer('r/foo/g');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_REGEX);
      expect(tok.value).toEqual({ body: 'foo', flags: 'g' });
    });

    test('returns operator token for delim chars', () => {
      const t = new Tokenizer('(');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_LEFT_PAREN);
    });

    test('parses symbol token', () => {
      const t = new Tokenizer('myVar');
      t.in_code = true;
      const tok = t.nextToken();
      expect(tok.type).toBe(TOKEN_SYMBOL);
      expect(tok.value).toBe('myVar');
    });

    test('returns null when finished in code mode', () => {
      const t = new Tokenizer('');
      t.in_code = true;
      expect(t.nextToken()).toBeNull();
    });
  });

  describe('trimBlocks option', () => {
    test('trims newline after block end when trimBlocks is true', () => {
      const t = new Tokenizer('{% if y %}\nz', { trimBlocks: true });
      t.nextToken();
      expect(t.in_code).toBe(true);
      while (!t.isFinished() && t.current() !== '%') {
        t.forward();
      }
      const end = t.nextToken();
      expect(end.type).toBe(TOKEN_BLOCK_END);
      expect(t.current()).toBe('z');
    });
  });

  describe('lex helper', () => {
    test('creates a Tokenizer from lex', () => {
      const t = lex('hello');
      expect(t).toBeInstanceOf(Tokenizer);
      expect(t.str).toBe('hello');
    });
  });
});

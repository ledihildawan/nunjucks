import { describe, test, expect } from 'bun:test';
import {
  extractBeginChars,
  extractWhileInCharSet,
  extractUntilCharSet,
  parseEscapeChar,
  parseStringContent,
  parseRegexContent,
} from './tokenizer-string-parsers.js';

describe('extractBeginChars', () => {
  test('extracts first characters from all tag delimiters', () => {
    const tags = {
      BLOCK_START: '{%',
      VARIABLE_START: '{{',
      COMMENT_START: '{#',
      COMMENT_END: '#}',
    };
    expect(extractBeginChars(tags)).toBe('{{{#');
  });

  test('handles single character tags', () => {
    const tags = {
      BLOCK_START: '<',
      VARIABLE_START: '$',
      COMMENT_START: '#',
      COMMENT_END: '#',
    };
    expect(extractBeginChars(tags)).toBe('<$##');
  });
});

describe('extractWhileInCharSet', () => {
  test('extracts consecutive characters in charset', () => {
    const str = '123abc';
    const charSet = '0123456789';
    expect(extractWhileInCharSet(str, 0, charSet)).toBe('123');
  });

  test('returns empty string when first char not in charset', () => {
    const str = 'abc123';
    const charSet = '0123456789';
    expect(extractWhileInCharSet(str, 0, charSet)).toBe('');
  });

  test('handles starting at middle index', () => {
    const str = 'abc123def';
    const charSet = '0123456789';
    expect(extractWhileInCharSet(str, 3, charSet)).toBe('123');
  });

  test('returns full string when all in charset', () => {
    const str = '123456';
    const charSet = '0123456789';
    expect(extractWhileInCharSet(str, 0, charSet)).toBe('123456');
  });

  test('handles empty string', () => {
    expect(extractWhileInCharSet('', 0, 'abc')).toBe('');
  });

  test('handles whitespace charset', () => {
    const str = '   hello';
    const charSet = ' \t\n';
    expect(extractWhileInCharSet(str, 0, charSet)).toBe('   ');
  });
});

describe('extractUntilCharSet', () => {
  test('extracts until character in charset', () => {
    const str = 'hello world';
    const charSet = ' ';
    expect(extractUntilCharSet(str, 0, charSet)).toBe('hello');
  });

  test('returns full string when no charset char found', () => {
    const str = 'hello';
    const charSet = 'xyz';
    expect(extractUntilCharSet(str, 0, charSet)).toBe('hello');
  });

  test('handles starting at middle index', () => {
    const str = 'hello world test';
    const charSet = ' ';
    expect(extractUntilCharSet(str, 6, charSet)).toBe('world');
  });

  test('handles multiple delimiter chars', () => {
    const str = 'hello,world;test';
    const charSet = ',;';
    expect(extractUntilCharSet(str, 0, charSet)).toBe('hello');
  });

  test('returns empty when first char is delimiter', () => {
    const str = ',hello';
    const charSet = ',';
    expect(extractUntilCharSet(str, 0, charSet)).toBe('');
  });
});

describe('parseEscapeChar', () => {
  test('parses newline', () => {
    expect(parseEscapeChar('n')).toBe('\n');
  });

  test('parses tab', () => {
    expect(parseEscapeChar('t')).toBe('\t');
  });

  test('parses carriage return', () => {
    expect(parseEscapeChar('r')).toBe('\r');
  });

  test('returns unknown escape as-is', () => {
    expect(parseEscapeChar('x')).toBe('x');
    expect(parseEscapeChar('z')).toBe('z');
  });
});

describe('parseStringContent', () => {
  test('extracts content between quotes', () => {
    const str = '"hello world"';
    expect(parseStringContent(str, 1, '"')).toBe('hello world');
  });

  test('handles single quotes', () => {
    const str = "'hello'";
    expect(parseStringContent(str, 1, "'")).toBe('hello');
  });

  test('handles escape sequences', () => {
    const str = '"hello\\nworld"';
    expect(parseStringContent(str, 1, '"')).toBe('hello\nworld');
  });

  test('handles escaped quotes', () => {
    const str = '"say \\"hello\\""';
    expect(parseStringContent(str, 1, '"')).toBe('say "hello"');
  });

  test('stops at delimiter', () => {
    const str = '"hello"world';
    expect(parseStringContent(str, 1, '"')).toBe('hello');
  });

  test('handles empty string', () => {
    const str = '""';
    expect(parseStringContent(str, 1, '"')).toBe('');
  });

  test('handles nested quotes', () => {
    const str = "'it\\'s working'";
    expect(parseStringContent(str, 1, "'")).toBe("it's working");
  });
});

describe('parseRegexContent', () => {
  test('extracts simple regex', () => {
    const str = '/test/';
    const result = parseRegexContent(str, 0, 'gimsuy', () => true);
    expect(result.body).toBe('test');
    expect(result.flags).toBe('');
    expect(result.consumed).toBe(6);
  });

  test('extracts regex with flags', () => {
    const str = '/test/gi';
    const result = parseRegexContent(str, 0, 'gimsuy', (c) => 'gi'.includes(c));
    expect(result.body).toBe('test');
    expect(result.flags).toBe('gi');
  });

  test('handles escaped forward slash', () => {
    const str = '/test\\/value/g';
    const result = parseRegexContent(str, 0, 'gimsuy', (c) => 'g'.includes(c));
    expect(result.body).toBe('test\\/value');
  });

  test('handles empty regex', () => {
    const str = '//';
    const result = parseRegexContent(str, 0, 'gimsuy', () => true);
    expect(result.body).toBe('');
    expect(result.flags).toBe('');
  });

  test('stops at invalid flag', () => {
    const str = '/test/gxy';
    const result = parseRegexContent(str, 0, 'gimsuy', (c) => 'g'.includes(c));
    expect(result.body).toBe('test');
    expect(result.flags).toBe('g');
  });
});

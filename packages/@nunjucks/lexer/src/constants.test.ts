import { describe, expect, test } from 'bun:test';
import {
  COMPLEX_OPERATORS,
  createDelimiters,
  DEFAULT_BLOCK_END,
  DEFAULT_BLOCK_START,
  DEFAULT_COMMENT_END,
  DEFAULT_COMMENT_START,
  DEFAULT_VARIABLE_END,
  DEFAULT_VARIABLE_START,
  DELIM_CHARS,
  INT_CHARS,
  isBooleanString,
  isComplexOperator,
  isDigit,
  isNullString,
  REGEX_FLAGS,
  WHITESPACE_CHARS,
} from './constants.ts';

describe('isComplexOperator', () => {
  test('returns true for every entry in COMPLEX_OPERATORS', () => {
    COMPLEX_OPERATORS.forEach((operator) => {
      expect(isComplexOperator(operator)).toBe(true);
    });
  });

  test('returns false for single-character operators and non-operators', () => {
    const nonOperators = [
      '+',
      '-',
      '=',
      '<',
      '>',
      '.',
      '|',
      '&',
      '?',
      ':',
      '!',
      '/',
      '*',
      '%',
      '~',
      '#',
      ',',
      '`',
      'foo',
      '',
      '==!',
      '<=>',
      ' ',
    ];
    nonOperators.forEach((token) => {
      expect(isComplexOperator(token)).toBe(false);
    });
  });
});

describe('isDigit', () => {
  test('returns true for each decimal digit', () => {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    digits.forEach((digit) => {
      expect(isDigit(digit)).toBe(true);
    });
  });

  test('returns false for non-digit characters', () => {
    const nonDigits = ['a', 'Z', '/', '-', '+', '.', '', ' ', '!', ':', '?', '~', '\n'];
    nonDigits.forEach((char) => {
      expect(isDigit(char)).toBe(false);
    });
  });

  test('returns true for every character in INT_CHARS', () => {
    INT_CHARS.split('').forEach((intChar) => {
      expect(isDigit(intChar)).toBe(true);
    });
  });
});

describe('isBooleanString', () => {
  test('returns true for lowercase boolean literals', () => {
    ['true', 'false'].forEach((literal) => {
      expect(isBooleanString(literal)).toBe(true);
    });
  });

  test('returns false for non-boolean strings', () => {
    const nonBooleans = [
      'True',
      'False',
      'TRUE',
      'FALSE',
      '',
      '0',
      '1',
      'yes',
      'no',
      'truthy',
      'falsy',
      'null',
      'none',
      ' true',
      'true ',
    ];
    nonBooleans.forEach((token) => {
      expect(isBooleanString(token)).toBe(false);
    });
  });
});

describe('isNullString', () => {
  test('returns true for nunjucks null literals', () => {
    ['none', 'null'].forEach((literal) => {
      expect(isNullString(literal)).toBe(true);
    });
  });

  test('returns false for non-null strings', () => {
    const nonNulls = [
      'None',
      'NULL',
      'Null',
      '',
      'nil',
      'undefined',
      'true',
      'false',
      'none ',
      ' null',
      'nonenull',
    ];
    nonNulls.forEach((token) => {
      expect(isNullString(token)).toBe(false);
    });
  });
});

describe('exported character-class constants', () => {
  test('WHITESPACE_CHARS contains the expected whitespace set', () => {
    expect(WHITESPACE_CHARS).toBe(' \n\t\r\u00A0');
    expect(WHITESPACE_CHARS).toHaveLength(5);
  });

  test('every WHITESPACE_CHARS entry is recognized as whitespace', () => {
    WHITESPACE_CHARS.split('').forEach((wsChar) => {
      expect(/\s/.test(wsChar) || wsChar === '\u00A0').toBe(true);
    });
  });

  test('DELIM_CHARS contains the expected delimiter set', () => {
    expect(DELIM_CHARS).toBe('()[]{}%*-+~/#,:|&.<>=!?`');
  });

  test('INT_CHARS contains the digits 0-9 in order', () => {
    expect(INT_CHARS).toBe('0123456789');
    expect(INT_CHARS).toHaveLength(10);
  });
});

describe('exported default delimiter tags', () => {
  test('DEFAULT_BLOCK_START and DEFAULT_BLOCK_END', () => {
    expect(DEFAULT_BLOCK_START).toBe('{%');
    expect(DEFAULT_BLOCK_END).toBe('%}');
  });

  test('DEFAULT_VARIABLE_START and DEFAULT_VARIABLE_END', () => {
    expect(DEFAULT_VARIABLE_START).toBe('{{');
    expect(DEFAULT_VARIABLE_END).toBe('}}');
  });

  test('DEFAULT_COMMENT_START and DEFAULT_COMMENT_END', () => {
    expect(DEFAULT_COMMENT_START).toBe('{#');
    expect(DEFAULT_COMMENT_END).toBe('#}');
  });
});

describe('COMPLEX_OPERATORS', () => {
  test('is a readonly tuple with the expected members', () => {
    expect(COMPLEX_OPERATORS).toEqual([
      '==',
      '===',
      '!=',
      '!==',
      '<=',
      '>=',
      '//',
      '**',
      '?.',
      '??',
      '.?',
      '||',
      '&&',
      '||=',
      '&&=',
      '??=',
      '|>',
      '..',
      '...',
      '**=',
      '//=',
      ':=',
      '<<',
      '>>',
      '++',
      '--',
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
      '|>=',
    ]);
    expect(COMPLEX_OPERATORS).toHaveLength(32);
  });

  test('contains no duplicates', () => {
    const unique = new Set<string>(COMPLEX_OPERATORS);
    expect(unique.size).toBe(COMPLEX_OPERATORS.length);
  });
});

describe('REGEX_FLAGS', () => {
  test('is the expected readonly tuple', () => {
    expect(REGEX_FLAGS).toEqual(['g', 'i', 'm', 'y']);
    expect(REGEX_FLAGS).toHaveLength(4);
  });
});

describe('createDelimiters', () => {
  test('returns the default tags when no overrides are given', () => {
    const delimiters = createDelimiters();
    expect(delimiters).toEqual({
      blockStart: DEFAULT_BLOCK_START,
      blockEnd: DEFAULT_BLOCK_END,
      variableStart: DEFAULT_VARIABLE_START,
      variableEnd: DEFAULT_VARIABLE_END,
      commentStart: DEFAULT_COMMENT_START,
      commentEnd: DEFAULT_COMMENT_END,
      stripBlockStart: '{%-',
      stripBlockEnd: '-%}',
      stripVariableStart: '{{-',
      stripVariableEnd: '-}}',
    });
  });

  test('applies provided tag overrides while leaving others at defaults', () => {
    const delimiters = createDelimiters({
      blockStart: '<%',
      variableEnd: '))',
      commentStart: '<#',
    });
    expect(delimiters.blockStart).toBe('<%');
    expect(delimiters.variableEnd).toBe('))');
    expect(delimiters.commentStart).toBe('<#');
    expect(delimiters.blockEnd).toBe(DEFAULT_BLOCK_END);
    expect(delimiters.variableStart).toBe(DEFAULT_VARIABLE_START);
    expect(delimiters.commentEnd).toBe(DEFAULT_COMMENT_END);
  });

  test('keeps strip tags fixed regardless of overrides', () => {
    const delimiters = createDelimiters({
      blockStart: '<%',
      blockEnd: '%>',
    });
    expect(delimiters.stripBlockStart).toBe('{%-');
    expect(delimiters.stripBlockEnd).toBe('-%}');
    expect(delimiters.stripVariableStart).toBe('{{-');
    expect(delimiters.stripVariableEnd).toBe('-}}');
  });

  test('treats empty-string overrides as present (not undefined)', () => {
    const delimiters = createDelimiters({ blockStart: '' });
    expect(delimiters.blockStart).toBe('');
  });
});

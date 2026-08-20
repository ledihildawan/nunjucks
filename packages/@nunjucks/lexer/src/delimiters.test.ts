import { describe, expect, test } from 'bun:test';
import {
  COMPLEX_OPERATORS,
  COMPOUND_ASSIGNMENT_OPS,
  createDelimiters,
  DEFAULT_BLOCK_END,
  DEFAULT_BLOCK_START,
  DEFAULT_COMMENT_END,
  DEFAULT_COMMENT_START,
  DEFAULT_VARIABLE_END,
  DEFAULT_VARIABLE_START,
  DELIM_CHARS,
  isBooleanString,
  isComplexOperator,
  isNullString,
  STRIP_BLOCK_END,
  STRIP_BLOCK_START,
  STRIP_VARIABLE_END,
  STRIP_VARIABLE_START,
  WHITESPACE_CHARS,
} from './delimiters.ts';

describe('character-class constants', () => {
  test('WHITESPACE_CHARS contains the expected whitespace set', () => {
    expect(WHITESPACE_CHARS).toBe(' \n\t\r\u00A0');
    expect(WHITESPACE_CHARS).toHaveLength(5);
  });

  test('DELIM_CHARS contains the expected delimiter set', () => {
    expect(DELIM_CHARS).toBe('()[]{}%*-+~/#,:|&.<>=!?`');
  });
});

describe('default tag constants', () => {
  test('DEFAULT_BLOCK_START and DEFAULT_BLOCK_END use the curly-percent style', () => {
    expect(DEFAULT_BLOCK_START).toBe('{%');
    expect(DEFAULT_BLOCK_END).toBe('%}');
  });

  test('DEFAULT_VARIABLE_START and DEFAULT_VARIABLE_END use the double-curly style', () => {
    expect(DEFAULT_VARIABLE_START).toBe('{{');
    expect(DEFAULT_VARIABLE_END).toBe('}}');
  });

  test('DEFAULT_COMMENT_START and DEFAULT_COMMENT_END use the curly-hash style', () => {
    expect(DEFAULT_COMMENT_START).toBe('{#');
    expect(DEFAULT_COMMENT_END).toBe('#}');
  });
});

describe('strip-tag constants', () => {
  test('STRIP_BLOCK_START and STRIP_BLOCK_END extend block delimiters with dashes', () => {
    expect(STRIP_BLOCK_START).toBe('{%-');
    expect(STRIP_BLOCK_END).toBe('-%}');
  });

  test('STRIP_VARIABLE_START and STRIP_VARIABLE_END extend variable delimiters with dashes', () => {
    expect(STRIP_VARIABLE_START).toBe('{{-');
    expect(STRIP_VARIABLE_END).toBe('-}}');
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

describe('COMPOUND_ASSIGNMENT_OPS', () => {
  test('contains the expected compound-assignment operators', () => {
    expect(COMPOUND_ASSIGNMENT_OPS).toEqual([
      '||=',
      '&&=',
      '??=',
      '**=',
      '//=',
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
    ]);
  });

  test('every entry is also present in COMPLEX_OPERATORS', () => {
    const complexSet = new Set<string>(COMPLEX_OPERATORS);
    COMPOUND_ASSIGNMENT_OPS.forEach((compoundOp) => {
      expect(complexSet.has(compoundOp)).toBe(true);
    });
  });

  test('contains no duplicates', () => {
    const unique = new Set(COMPOUND_ASSIGNMENT_OPS);
    expect(unique.size).toBe(COMPOUND_ASSIGNMENT_OPS.length);
  });
});

describe('createDelimiters', () => {
  test('returns the default tags when no argument is given', () => {
    const delimiters = createDelimiters();
    expect(delimiters).toEqual({
      blockStart: DEFAULT_BLOCK_START,
      blockEnd: DEFAULT_BLOCK_END,
      variableStart: DEFAULT_VARIABLE_START,
      variableEnd: DEFAULT_VARIABLE_END,
      commentStart: DEFAULT_COMMENT_START,
      commentEnd: DEFAULT_COMMENT_END,
      stripBlockStart: STRIP_BLOCK_START,
      stripBlockEnd: STRIP_BLOCK_END,
      stripVariableStart: STRIP_VARIABLE_START,
      stripVariableEnd: STRIP_VARIABLE_END,
    });
  });

  test('returns the default tags when an empty override object is given', () => {
    const delimiters = createDelimiters({});
    expect(delimiters.blockStart).toBe(DEFAULT_BLOCK_START);
    expect(delimiters.blockEnd).toBe(DEFAULT_BLOCK_END);
    expect(delimiters.variableStart).toBe(DEFAULT_VARIABLE_START);
    expect(delimiters.variableEnd).toBe(DEFAULT_VARIABLE_END);
    expect(delimiters.commentStart).toBe(DEFAULT_COMMENT_START);
    expect(delimiters.commentEnd).toBe(DEFAULT_COMMENT_END);
  });

  test('applies block delimiter overrides while leaving others at defaults', () => {
    const delimiters = createDelimiters({ blockStart: '<%', blockEnd: '%>' });
    expect(delimiters.blockStart).toBe('<%');
    expect(delimiters.blockEnd).toBe('%>');
    expect(delimiters.variableStart).toBe(DEFAULT_VARIABLE_START);
    expect(delimiters.variableEnd).toBe(DEFAULT_VARIABLE_END);
    expect(delimiters.commentStart).toBe(DEFAULT_COMMENT_START);
    expect(delimiters.commentEnd).toBe(DEFAULT_COMMENT_END);
  });

  test('applies variable delimiter overrides while leaving others at defaults', () => {
    const delimiters = createDelimiters({ variableStart: '<<', variableEnd: '>>' });
    expect(delimiters.variableStart).toBe('<<');
    expect(delimiters.variableEnd).toBe('>>');
    expect(delimiters.blockStart).toBe(DEFAULT_BLOCK_START);
    expect(delimiters.blockEnd).toBe(DEFAULT_BLOCK_END);
    expect(delimiters.commentStart).toBe(DEFAULT_COMMENT_START);
    expect(delimiters.commentEnd).toBe(DEFAULT_COMMENT_END);
  });

  test('applies comment delimiter overrides while leaving others at defaults', () => {
    const delimiters = createDelimiters({ commentStart: '<#', commentEnd: '#>' });
    expect(delimiters.commentStart).toBe('<#');
    expect(delimiters.commentEnd).toBe('#>');
    expect(delimiters.blockStart).toBe(DEFAULT_BLOCK_START);
    expect(delimiters.variableStart).toBe(DEFAULT_VARIABLE_START);
  });

  test('applies a partial subset of overrides across categories', () => {
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

  test('rejects empty-string overrides for every tag (matches("") hazard)', () => {
    const emptyOverrides = [
      { blockStart: '' },
      { blockEnd: '' },
      { variableStart: '' },
      { variableEnd: '' },
      { commentStart: '' },
      { commentEnd: '' },
    ] as const;
    emptyOverrides.forEach((override) => {
      expect(() => createDelimiters(override)).toThrow(/non-empty/);
    });
  });

  test('keeps strip tags fixed regardless of overrides', () => {
    const delimiters = createDelimiters({
      blockStart: '<%',
      blockEnd: '%>',
      variableStart: '<<',
      variableEnd: '>>',
      commentStart: '<#',
      commentEnd: '#>',
    });
    expect(delimiters.stripBlockStart).toBe(STRIP_BLOCK_START);
    expect(delimiters.stripBlockEnd).toBe(STRIP_BLOCK_END);
    expect(delimiters.stripVariableStart).toBe(STRIP_VARIABLE_START);
    expect(delimiters.stripVariableEnd).toBe(STRIP_VARIABLE_END);
  });

  test('returns a fresh object on each call (no shared mutable state)', () => {
    const first = createDelimiters();
    const second = createDelimiters();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

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

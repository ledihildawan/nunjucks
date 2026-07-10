import { expect, describe, test } from 'bun:test';
import {
  WHITESPACE_CHARS, DELIM_CHARS, INT_CHARS,
  DEFAULT_BLOCK_START, DEFAULT_BLOCK_END,
  DEFAULT_VARIABLE_START, DEFAULT_VARIABLE_END,
  DEFAULT_COMMENT_START, DEFAULT_COMMENT_END,
  COMPLEX_OPERATORS, REGEX_FLAGS,
  createDelimiters,
} from './delimiters.js';

describe('character constants', () => {
  test('WHITESPACE_CHARS includes space, newline, tab, cr, non-breaking space', () => {
    expect(WHITESPACE_CHARS).toBe(' \n\t\r\u00A0');
  });

  test('DELIM_CHARS includes expected characters', () => {
    expect(DELIM_CHARS).toContain('(');
    expect(DELIM_CHARS).toContain(')');
    expect(DELIM_CHARS).toContain('|');
    expect(DELIM_CHARS).toContain('.');
    expect(DELIM_CHARS).toContain('!');
    expect(DELIM_CHARS).toContain('?');
  });

  test('INT_CHARS includes all digits', () => {
    expect(INT_CHARS).toBe('0123456789');
  });
});

describe('default delimiters', () => {
  test('DEFAULT_BLOCK_START is {%', () => {
    expect(DEFAULT_BLOCK_START).toBe('{%');
  });

  test('DEFAULT_BLOCK_END is %}', () => {
    expect(DEFAULT_BLOCK_END).toBe('%}');
  });

  test('DEFAULT_VARIABLE_START is {{', () => {
    expect(DEFAULT_VARIABLE_START).toBe('{{');
  });

  test('DEFAULT_VARIABLE_END is }}', () => {
    expect(DEFAULT_VARIABLE_END).toBe('}}');
  });

  test('DEFAULT_COMMENT_START is {#', () => {
    expect(DEFAULT_COMMENT_START).toBe('{#');
  });

  test('DEFAULT_COMMENT_END is #}', () => {
    expect(DEFAULT_COMMENT_END).toBe('#}');
  });
});

describe('COMPLEX_OPERATORS', () => {
  test('contains comparison and logical operators', () => {
    expect(COMPLEX_OPERATORS).toContain('==');
    expect(COMPLEX_OPERATORS).toContain('!==');
    expect(COMPLEX_OPERATORS).toContain('<=');
    expect(COMPLEX_OPERATORS).toContain('**');
    expect(COMPLEX_OPERATORS).toContain('?.');
    expect(COMPLEX_OPERATORS).toContain('??');
    expect(COMPLEX_OPERATORS).toContain('|>');
  });
});

describe('REGEX_FLAGS', () => {
  test('contains g, i, m, y', () => {
    expect(REGEX_FLAGS).toEqual(['g', 'i', 'm', 'y']);
  });
});

describe('createDelimiters', () => {
  test('returns all defaults when no options given', () => {
    const d = createDelimiters();
    expect(d.BLOCK_START).toBe('{%');
    expect(d.BLOCK_END).toBe('%}');
    expect(d.VARIABLE_START).toBe('{{');
    expect(d.VARIABLE_END).toBe('}}');
    expect(d.COMMENT_START).toBe('{#');
    expect(d.COMMENT_END).toBe('#}');
  });

  test('overrides specific delimiters', () => {
    const d = createDelimiters({ blockStart: '[%', blockEnd: '%]' });
    expect(d.BLOCK_START).toBe('[%');
    expect(d.BLOCK_END).toBe('%]');
    expect(d.VARIABLE_START).toBe('{{');
    expect(d.COMMENT_START).toBe('{#');
  });

  test('overrides all delimiters', () => {
    const d = createDelimiters({
      blockStart: '[%', blockEnd: '%]',
      variableStart: '[[', variableEnd: ']]',
      commentStart: '[#', commentEnd: '#]',
    });
    expect(d.BLOCK_START).toBe('[%');
    expect(d.VARIABLE_START).toBe('[[');
    expect(d.COMMENT_START).toBe('[#');
  });

  test('returns defaults when called with empty object', () => {
    const d = createDelimiters({});
    expect(d.BLOCK_START).toBe('{%');
    expect(d.VARIABLE_START).toBe('{{');
  });
});

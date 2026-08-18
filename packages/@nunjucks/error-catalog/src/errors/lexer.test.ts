import { describe, expect, test } from 'bun:test';
import { LEXER_ERRORS } from './lexer.ts';
import type { ErrorDefinition } from './types.ts';

const entries = Object.entries(LEXER_ERRORS) as readonly [string, ErrorDefinition][];

describe('LEXER_ERRORS definitions', () => {
  test('each entry is keyed by its own name and carries a category plus guidance', () => {
    for (const [name, def] of entries) {
      expect(def.name).toBe(name);
      expect(def.category).toBe('lexer_error');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('message templates interpolate their declared placeholders', () => {
    expect(LEXER_ERRORS.UNEXPECTED_CHAR.message.replaceAll('{char}', '~')).toBe(
      "Unexpected character '~'"
    );
    expect(LEXER_ERRORS.UNTERMINATED_LITERAL.message.replaceAll('{kind}', 'string')).toBe(
      'Unterminated string literal'
    );
  });
});

describe('UNEXPECTED_CHAR', () => {
  test('pattern requires the full line:column suffix and captures the character', () => {
    const { pattern } = LEXER_ERRORS.UNEXPECTED_CHAR;
    const match = "Unexpected character '~' at line 3:7".match(pattern);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('~');
    expect(pattern.test("Unexpected character '~' at line 3")).toBe(false);
    expect(pattern.test("Unexpected character '~' somewhere")).toBe(false);
  });

  test('subjectFrom extracts the offending character', () => {
    const match = "Unexpected character '&' at line 1:1".match(
      LEXER_ERRORS.UNEXPECTED_CHAR.pattern
    );
    expect(LEXER_ERRORS.UNEXPECTED_CHAR.subjectFrom?.(match as RegExpMatchArray)).toBe('&');
  });
});

describe('UNEXPECTED_BACKTICK', () => {
  test('matches its own message only, with no subject', () => {
    const { pattern, subjectFrom } = LEXER_ERRORS.UNEXPECTED_BACKTICK;
    expect(pattern.test('Unexpected backtick in template expression')).toBe(true);
    expect(pattern.test('Unexpected backtick in template expression here')).toBe(false);
    expect(subjectFrom).toBeNull();
  });
});

describe('UNTERMINATED_LITERAL', () => {
  test('pattern captures the literal kind', () => {
    const match = 'Unterminated string literal'.match(LEXER_ERRORS.UNTERMINATED_LITERAL.pattern);
    expect(match?.[1]).toBe('string');
    expect(LEXER_ERRORS.UNTERMINATED_LITERAL.pattern.test('Unterminated literal')).toBe(false);
  });

  test('subjectFrom extracts the literal kind', () => {
    const match = 'Unterminated comment literal'.match(LEXER_ERRORS.UNTERMINATED_LITERAL.pattern);
    expect(LEXER_ERRORS.UNTERMINATED_LITERAL.subjectFrom?.(match as RegExpMatchArray)).toBe(
      'comment'
    );
  });
});

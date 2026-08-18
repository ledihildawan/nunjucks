import { describe, expect, test } from 'bun:test';
import { reservedKeywordClassifier } from './reserved-keyword.ts';
import { RESERVED_KEYWORD_CONTEXT_TITLE } from './runtime/reference-errors.ts';

describe('reservedKeywordClassifier', () => {
  test('claims only RESERVED_KEYWORD_CONTEXT inputs and defers otherwise', () => {
    expect(reservedKeywordClassifier({ code: 'RESERVED_KEYWORD_CONTEXT' })).not.toBeNull();
    expect(reservedKeywordClassifier({ code: 'UNDEFINED_VARIABLE' })).toBeNull();
    expect(reservedKeywordClassifier({ message: 'anything' })).toBeNull();
    expect(reservedKeywordClassifier({})).toBeNull();
  });

  test('renders the title from the shared title constant', () => {
    const cls = reservedKeywordClassifier({ code: 'RESERVED_KEYWORD_CONTEXT', subject: 'super' });
    expect(cls?.title).toBe(RESERVED_KEYWORD_CONTEXT_TITLE.replaceAll('{subject}', 'super'));
    expect(cls?.title).toBe("Cannot use reserved keyword 'super' outside of its intended context");
  });

  test('super gets keyword-specific guidance mentioning the extends requirement', () => {
    const cls = reservedKeywordClassifier({ code: 'RESERVED_KEYWORD_CONTEXT', subject: 'super' });
    expect(cls?.category).toBe('reserved_keyword_context');
    expect(cls?.undefinedName).toBe('super');
    expect(cls?.severity).toBe('error');
    expect(cls?.causes.some((c) => c.includes('extends'))).toBe(true);
    expect(cls?.fixCode).toContain('{% extends');
    expect(cls?.documentationUrl).toBeNull();
  });

  test('an unknown keyword falls back to generic rename guidance', () => {
    const cls = reservedKeywordClassifier({ code: 'RESERVED_KEYWORD_CONTEXT', subject: 'fn' });
    expect(cls?.undefinedName).toBe('fn');
    expect(cls?.causes.some((c) => c.includes('reserved'))).toBe(true);
    expect(cls?.fixCode).toContain('Rename');
    expect(cls?.causes.some((c) => c.includes('extends'))).toBe(false);
  });

  test('a missing subject defaults to the unknown keyword', () => {
    const cls = reservedKeywordClassifier({ code: 'RESERVED_KEYWORD_CONTEXT' });
    expect(cls?.undefinedName).toBe('unknown');
    expect(cls?.title).toContain('unknown');
  });
});

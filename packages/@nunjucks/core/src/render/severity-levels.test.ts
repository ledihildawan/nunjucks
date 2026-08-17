import { describe, expect, test } from 'bun:test';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import { getSeverity } from './severity-levels.ts';

const errorWithCode = (code: string): Error => Object.assign(new Error('boom'), { code });

// Mirrors BLOCK_ERROR_CODES — the partition pin: moving a code in/out of the table
// flips exactly one of the first two tests.
const BLOCK_CODES: readonly string[] = [
  ERROR_CODES.ASSERT_TYPE_ERROR,
  ERROR_CODES.CIRCULAR_INCLUDE,
  ERROR_CODES.DUPLICATE_BLOCK,
  ERROR_CODES.EXEC_EXPRESSION_ERROR,
  ERROR_CODES.FILE_NOT_FOUND,
  ERROR_CODES.FILESYSTEM_ERROR,
  ERROR_CODES.IMPORT_ERROR,
  ERROR_CODES.INVALID_CONFIG,
  ERROR_CODES.INVALID_INCLUDE,
  ERROR_CODES.NO_SUPER_BLOCK,
  ERROR_CODES.RENDER_ERROR,
  ERROR_CODES.RESERVED_KEYWORD_CONTEXT,
  ERROR_CODES.SANDBOX_CODE_EXECUTION,
  ERROR_CODES.TEMPLATE_SIZE_EXCEEDED,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.UNDEFINED_BLOCK,
  ERROR_CODES.UNKNOWN_BLOCK_RUNTIME,
];

describe('getSeverity', () => {
  test('every BLOCK table member maps to block severity', () => {
    for (const code of BLOCK_CODES) {
      expect(getSeverity(errorWithCode(code)), code).toBe('block');
    }
  });

  test('table invariant: every other catalog code maps to inline', () => {
    const blockSet = new Set(BLOCK_CODES);
    for (const code of Object.values(ERROR_CODES)) {
      if (!blockSet.has(code)) {
        expect(getSeverity(errorWithCode(code)), code).toBe('inline');
      }
    }
  });

  test('codes outside the catalog degrade to inline', () => {
    expect(getSeverity(errorWithCode('NOT_IN_CATALOG'))).toBe('inline');
  });

  test('plain errors without a code are inline', () => {
    expect(getSeverity(new Error('no code'))).toBe('inline');
  });

  test('non-error input degrades to inline', () => {
    expect(getSeverity(null)).toBe('inline');
    expect(getSeverity(undefined)).toBe('inline');
    expect(getSeverity('string')).toBe('inline');
  });
});

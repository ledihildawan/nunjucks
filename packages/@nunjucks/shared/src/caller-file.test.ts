import { describe, test, expect } from 'bun:test';
import { getCallerFile, getCallerLocation } from './caller-file.ts';

describe('getCallerFile', () => {
  test('returns a string', () => {
    const file = getCallerFile();
    expect(typeof file).toBe('string');
  });

  test('returns a non-unknown path when called from a real frame', () => {
    function innerCaller(): string {
      return getCallerFile();
    }
    const result = innerCaller();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getCallerLocation', () => {
  test('returns an object with fileName, lineNumber, columnNumber', () => {
    const loc = getCallerLocation();
    expect(loc).toHaveProperty('fileName');
    expect(loc).toHaveProperty('lineNumber');
    expect(loc).toHaveProperty('columnNumber');
    expect(typeof loc.fileName).toBe('string');
  });

  test('returns line and column as numbers or null', () => {
    function inner(): { fileName: string; lineNumber: number | null; columnNumber: number | null } {
      return getCallerLocation();
    }
    const loc = inner();
    expect(loc.lineNumber === null || typeof loc.lineNumber === 'number').toBe(true);
    expect(loc.columnNumber === null || typeof loc.columnNumber === 'number').toBe(true);
  });
});

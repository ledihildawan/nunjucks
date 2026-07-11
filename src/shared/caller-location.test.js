import { describe, it, expect } from 'bun:test';
import { getCallerLocation, formatCallerLocation } from './caller-location.js';

describe('getCallerLocation', () => {
  it('returns null for empty stack', () => {
    const orig = Error.stack;
    Error.stack = undefined;
    const result = getCallerLocation();
    Error.stack = orig;
    expect(result).toBeNull();
  });

  it('skips nunjucks internal frames', () => {
    const result = getCallerLocation();
    if (result) {
      expect(result.fullPath).not.toContain('/nunjucks/src/');
    }
  });

  it('skips node_modules frames', () => {
    const result = getCallerLocation();
    if (result) {
      expect(result.fullPath).not.toContain('/node_modules/');
    }
  });

  it('returns object with required properties when called from test file', () => {
    const result = getCallerLocation();
    if (result) {
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('fullPath');
      expect(result).toHaveProperty('line');
      expect(result).toHaveProperty('column');
    }
  });

  it('handles .mjs files in stack', () => {
    const err = new Error();
    err.stack = `Error
    at getCallerLocation (C:/test/file.mjs:10:5)
    at test (C:/test/file.mjs:20:10)`;
    
    const lines = err.stack.split('\n');
    let found = null;
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/\(([^)]+):(\d+):(\d+)\)/);
      if (match && match[1].endsWith('.mjs')) {
        found = {
          file: match[1].split(/[\\/]/).pop(),
          fullPath: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10)
        };
        break;
      }
    }
    expect(found).not.toBeNull();
    expect(found.file).toBe('file.mjs');
  });

  it('handles .ts files in stack', () => {
    const err = new Error();
    err.stack = `Error
    at getCallerLocation (C:/test/file.ts:10:5)
    at test (C:/test/file.ts:20:10)`;
    
    const lines = err.stack.split('\n');
    let found = null;
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/\(([^)]+):(\d+):(\d+)\)/);
      if (match && match[1].endsWith('.ts')) {
        found = {
          file: match[1].split(/[\\/]/).pop(),
          fullPath: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10)
        };
        break;
      }
    }
    expect(found).not.toBeNull();
    expect(found.file).toBe('file.ts');
  });
});

describe('formatCallerLocation', () => {
  it('returns null for null input', () => {
    expect(formatCallerLocation(null)).toBeNull();
  });

  it('formats correctly', () => {
    const caller = { file: 'test.js', fullPath: '/path/to/test.js', line: 10, column: 5 };
    expect(formatCallerLocation(caller)).toBe('test.js:10:5');
  });

  it('handles missing column', () => {
    const caller = { file: 'test.js', fullPath: '/path/to/test.js', line: 10, column: 1 };
    expect(formatCallerLocation(caller)).toBe('test.js:10:1');
  });
});

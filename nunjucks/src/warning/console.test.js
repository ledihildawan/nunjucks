import { describe, test, expect } from 'bun:test';
import { toConsoleString } from './console.js';

describe('toConsoleString', () => {
  test('formats warning with varName and templateName', () => {
    const warning = {
      message: "Variable 'user' is undefined or null",
      lineno: 5,
      colno: 10,
      varName: 'user',
      templateName: 'C:/projects/templates/index.html'
    };
    const result = toConsoleString(warning);
    expect(result).toContain('[WARNING]');
    expect(result).toContain("Undefined variable 'user'");
    expect(result).toContain('at');
    expect(result).toContain('index.html:6');
  });

  test('formats warning without varName', () => {
    const warning = {
      message: 'Variable is undefined or null',
      lineno: 0,
      colno: 5,
      varName: null,
      templateName: null
    };
    const result = toConsoleString(warning);
    expect(result).toContain('[WARNING]');
    expect(result).toContain('Undefined variable');
    expect(result).toContain('at');
    expect(result).toContain('1');
  });

  test('formats warning without templateName', () => {
    const warning = {
      message: "Variable 'data' is undefined or null",
      lineno: 10,
      colno: 3,
      varName: 'data',
      templateName: null
    };
    const result = toConsoleString(warning);
    expect(result).toContain('[WARNING]');
    expect(result).toContain("Undefined variable 'data'");
    expect(result).toContain('at');
    expect(result).toContain('11');
  });
});

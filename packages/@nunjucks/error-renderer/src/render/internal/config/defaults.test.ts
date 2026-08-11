import { describe, test, expect } from 'bun:test';
import { DEFAULT_IDE, DEFAULT_VERSION } from './defaults.ts';

describe('defaults', () => {
  test('DEFAULT_IDE is vscode', () => {
    expect(DEFAULT_IDE).toBe('vscode');
  });

  test('DEFAULT_VERSION is the expected semantic version', () => {
    expect(DEFAULT_VERSION).toBe('3.2.4');
  });

  test('DEFAULT_VERSION matches a semantic version shape', () => {
    expect(/^\d+\.\d+\.\d+$/u.test(DEFAULT_VERSION)).toBe(true);
  });

  test('exports string constants', () => {
    expect(typeof DEFAULT_IDE).toBe('string');
    expect(typeof DEFAULT_VERSION).toBe('string');
  });
});

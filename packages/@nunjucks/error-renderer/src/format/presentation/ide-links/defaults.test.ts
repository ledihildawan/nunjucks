import { describe, expect, test } from 'bun:test';
import { DEFAULT_IDE } from './defaults.ts';

describe('defaults', () => {
  test('DEFAULT_IDE is vscode', () => {
    expect(DEFAULT_IDE).toBe('vscode');
  });

  test('exports string constants', () => {
    expect(typeof DEFAULT_IDE).toBe('string');
  });
});

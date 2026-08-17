import { describe, test, expect } from 'bun:test';
import {
  resolveMessage,
  isErrorDefinitionEntry,
  extractExtraFromContext,
} from './create-log-helpers.ts';

describe('resolveMessage', () => {
  test('returns a plain string message unchanged', () => {
    expect(resolveMessage('hello', undefined)).toBe('hello');
  });

  test('invokes a function message with the params', () => {
    const message = (p?: Record<string, string> | string[]) =>
      `hi ${(p as Record<string, string> | undefined)?.name ?? ''}`;
    expect(resolveMessage(message, { name: 'world' })).toBe('hi world');
  });

  test('interpolates {key} placeholders in a string message when params are given', () => {
    expect(resolveMessage('Hello {name}!', { name: 'world' })).toBe('Hello world!');
  });

  test('leaves placeholders untouched when no params are given', () => {
    expect(resolveMessage('Hello {name}!', undefined)).toBe('Hello {name}!');
  });
});

describe('isErrorDefinitionEntry', () => {
  test('accepts an object with a string message and no lineno', () => {
    expect(isErrorDefinitionEntry({ name: 'X', message: 'boom', pattern: /x/ })).toBe(true);
  });

  test('accepts a function message', () => {
    expect(isErrorDefinitionEntry({ name: 'X', message: () => 'boom', pattern: /x/ })).toBe(true);
  });

  test('rejects legacy data carrying a lineno', () => {
    expect(isErrorDefinitionEntry({ message: 'boom', lineno: 5 })).toBe(false);
  });

  test('rejects non-objects and objects without a message', () => {
    expect(isErrorDefinitionEntry(null)).toBe(false);
    expect(isErrorDefinitionEntry('s')).toBe(false);
    expect(isErrorDefinitionEntry({ code: 'X' })).toBe(false);
  });
});

describe('extractExtraFromContext', () => {
  test('returns undefined for null/undefined context', () => {
    expect(extractExtraFromContext(null)).toBeUndefined();
    expect(extractExtraFromContext(undefined)).toBeUndefined();
  });

  test('strips the known structural keys, keeping extras', () => {
    const ctx = {
      lineno: 1,
      colno: 2,
      phase: 'render',
      templateName: 't',
      lineBase: 'zero',
      custom: 9,
      other: 'y',
    } as Record<string, unknown>;
    const extra = extractExtraFromContext(ctx as never);
    expect(extra).toEqual({ custom: 9, other: 'y' });
  });

  test('returns undefined-shaped when only structural keys are present', () => {
    expect(extractExtraFromContext({ lineno: 1, phase: 'render' } as never)).toEqual({});
  });
});

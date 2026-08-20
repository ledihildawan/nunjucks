import { describe, expect, test } from 'bun:test';
import { sanitizeForAnsi, sanitizePrimitive, sanitizeTerminalText } from './sanitize-helpers.ts';

describe('sanitizeTerminalText', () => {
  test('strips ESC, BEL and 8-bit CSI control characters', () => {
    // WHY: the literal '[2J' text is inert without its ESC — only controls are removed.
    expect(sanitizeTerminalText('ev\x1b[2Jil\x07')).toBe('ev[2Jil');
    expect(sanitizeTerminalText('a\x9bb')).toBe('ab');
  });

  test('strips the rest of C0, DEL and C1', () => {
    expect(sanitizeTerminalText('\x00\x01\x08\x0b\x0c\x0e\x1f\x7f\x80\x9f')).toBe('');
  });

  test('preserves tab, newline and carriage return', () => {
    expect(sanitizeTerminalText('a\tb\nc\rd')).toBe('a\tb\nc\rd');
  });

  test('leaves plain text untouched', () => {
    expect(sanitizeTerminalText('template not found: views/app.njk')).toBe(
      'template not found: views/app.njk'
    );
  });
});

describe('sanitizePrimitive', () => {
  test('null', () => {
    expect(sanitizePrimitive(null)).toBe('null');
  });

  test('undefined', () => {
    expect(sanitizePrimitive(undefined)).toBe('undefined');
  });

  test('named function', () => {
    expect(sanitizePrimitive(function myFn() {})).toBe('[Function: myFn]');
  });

  test('anonymous function', () => {
    expect(sanitizePrimitive(() => {})).toBe('[Function: anonymous]');
  });

  test('string', () => {
    expect(sanitizePrimitive('hi')).toBe('"hi"');
  });

  test('string with terminal controls is stripped before quoting', () => {
    expect(sanitizePrimitive('ev\x1b[2Jil\x07')).toBe('"ev[2Jil"');
  });

  test('number', () => {
    expect(sanitizePrimitive(42)).toBe('42');
  });
});

describe('sanitizeForAnsi', () => {
  test('primitive passthrough', () => {
    expect(sanitizeForAnsi('x')).toBe('"x"');
  });

  test('null is not treated as object', () => {
    expect(sanitizeForAnsi(null)).toBe('null');
  });

  test('array', () => {
    expect(sanitizeForAnsi([1, 2, 3])).toBe('Array(3)');
  });

  test('object', () => {
    expect(sanitizeForAnsi({ a: 1, b: 2 })).toBe('Object(2)');
  });

  test('circular reference', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(sanitizeForAnsi(obj)).toBe('Object(1)');
  });
});

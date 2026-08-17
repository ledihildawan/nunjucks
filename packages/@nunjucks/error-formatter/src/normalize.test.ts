import { describe, test, expect } from 'bun:test';
import { normalizeErrorMetadata } from './normalize.ts';

describe('normalizeErrorMetadata', () => {
  test('keeps a real Error and its message', () => {
    const original = new Error('boom');
    const meta = normalizeErrorMetadata(original);
    expect(meta.error).toBe(original);
    expect(meta.message).toBe('boom');
  });

  test('wraps a non-Error thrown value in a new Error with a useful message', () => {
    const meta = normalizeErrorMetadata('plain string');
    expect(meta.error).toBeInstanceOf(Error);
    expect(meta.message).toBe('plain string');
  });

  test('stringifies null and undefined inputs', () => {
    expect(normalizeErrorMetadata(null).message).toBe('null');
    expect(normalizeErrorMetadata(undefined).message).toBe('undefined');
  });

  test('a throwing getter on metadata fields degrades to fallbacks instead of crashing', () => {
    const hostile = {
      message: 'boom',
      get lineno(): number {
        throw new Error('hostile getter');
      },
      get code(): string {
        throw new Error('hostile getter');
      },
    };
    const meta = normalizeErrorMetadata(hostile, { code: 'FALLBACK' });
    expect(meta.message).toBe('boom');
    expect(meta.lineno).toBeNull();
    expect(meta.code).toBe('FALLBACK');
  });

  test('reads metadata fields off an error-like object', () => {
    const thrown = { message: 'oops', lineno: 4, colno: 2, code: 'X', lineBase: 'one' };
    const meta = normalizeErrorMetadata(thrown);
    expect(meta.message).toBe('oops');
    expect(meta.lineno).toBe(4);
    expect(meta.colno).toBe(2);
    expect(meta.code).toBe('X');
    expect(meta.lineBase).toBe('one');
  });

  test('applies fallback values when the source lacks fields', () => {
    const meta = normalizeErrorMetadata(new Error('e'), {
      lineno: 9,
      phase: 'compile',
      templateName: 't.njk',
    });
    expect(meta.lineno).toBe(9);
    expect(meta.phase).toBe('compile');
    expect(meta.templateName).toBe('t.njk');
  });

  test('source fields take precedence over fallbacks', () => {
    const thrown = Object.assign(new Error('e'), { lineno: 1, code: 'SRC' });
    const meta = normalizeErrorMetadata(thrown, { lineno: 99, code: 'FB' });
    expect(meta.lineno).toBe(1);
    expect(meta.code).toBe('SRC');
  });

  test('defaults an unrecognised lineBase on the thrown value to a valid base', () => {
    const thrown = Object.assign(new Error('e'), { lineBase: 'bogus' });
    const meta = normalizeErrorMetadata(thrown);
    expect(meta.lineBase === 'zero' || meta.lineBase === 'one').toBe(true);
  });
});

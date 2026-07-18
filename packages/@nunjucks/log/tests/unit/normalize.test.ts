import { describe, expect, test } from 'bun:test';
import { normalizeErrorMetadata } from '../../src/error/normalize.ts';

describe('normalizeErrorMetadata', () => {
  test('normalizes primitive thrown values', () => {
    expect(normalizeErrorMetadata('boom').message).toBe('boom');
    expect(normalizeErrorMetadata(42).message).toBe('42');
    expect(normalizeErrorMetadata(null).message).toBe('null');
    expect(normalizeErrorMetadata(undefined).message).toBe('undefined');
  });

  test('preserves precise metadata and fills missing fallback fields', () => {
    const error = Object.assign(new Error('boom'), {
      lineno: 4,
      colno: 9,
      lineBase: 'one',
      code: 'CUSTOM',
      subject: 'value',
      templateName: 'child.njk'
    });
    const metadata = normalizeErrorMetadata(error, {
      lineno: 1,
      colno: 2,
      phase: 'render',
      templatePath: '/templates/child.njk',
      sourceContent: '{{ value }}',
      renderContext: { value: 1 }
    });

    expect(metadata).toMatchObject({
      message: 'boom',
      lineno: 4,
      colno: 9,
      lineBase: 'one',
      code: 'CUSTOM',
      subject: 'value',
      phase: 'render',
      templateName: 'child.njk',
      templatePath: '/templates/child.njk',
      sourceContent: '{{ value }}',
      renderContext: { value: 1 }
    });
  });

  test('does not mutate frozen or sealed errors', () => {
    const frozen = Object.freeze(new Error('frozen'));
    const sealed = Object.seal(new Error('sealed'));

    expect(() => normalizeErrorMetadata(frozen, { lineno: 1 })).not.toThrow();
    expect(() => normalizeErrorMetadata(sealed, { colno: 2 })).not.toThrow();
    expect(normalizeErrorMetadata(frozen, { lineno: 1 }).lineno).toBe(1);
    expect(normalizeErrorMetadata(sealed, { colno: 2 }).colno).toBe(2);
  });

  test('validates malformed metadata', () => {
    const metadata = normalizeErrorMetadata({
      message: 'bad metadata',
      lineno: '4',
      colno: NaN,
      lineBase: 'invalid',
      renderContext: 'invalid'
    }, { lineno: 2, colno: 3, lineBase: 'one', renderContext: { ok: true } });

    expect(metadata.lineno).toBe(2);
    expect(metadata.colno).toBe(3);
    expect(metadata.lineBase).toBe('one');
    expect(metadata.renderContext).toEqual({ ok: true });
  });
});

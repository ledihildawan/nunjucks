import { describe, expect, test } from 'bun:test';
import type { ErrorWithLineInfo } from './template-error-handler.ts';
import {
  buildErrorMessage,
  createTemplateErrorHandler,
  extractFrameDetails,
} from './template-error-handler.ts';

describe('buildErrorMessage', () => {
  test('includes path and line info', () => {
    const e = { message: 'test error' } as ErrorWithLineInfo;
    const result = buildErrorMessage({
      currentPath: 'test.html',
      sourceLineno: 5,
      finalColno: 10,
      e,
    });
    expect(result).toContain('(test.html)');
    expect(result).toContain('[Line 5, Column 10]');
    expect(result).toContain('test error');
  });

  test('includes only line when colno is 0', () => {
    const e = { message: 'test error' } as ErrorWithLineInfo;
    const result = buildErrorMessage({
      currentPath: 'test.html',
      sourceLineno: 5,
      finalColno: 0,
      e,
    });
    expect(result).toContain('(test.html)');
    expect(result).toContain('[Line 5]');
  });

  test('returns just path and message when no line info', () => {
    const e = { message: 'test error' } as ErrorWithLineInfo;
    const result = buildErrorMessage({
      currentPath: 'test.html',
      sourceLineno: undefined,
      finalColno: 0,
      e,
    });
    expect(result).toContain('(test.html)');
    expect(result).not.toContain('[Line');
  });
});

describe('extractFrameDetails', () => {
  test('returns null when hasIncludeChain is true', () => {
    const e = { message: 'test', lineno: 5 } as ErrorWithLineInfo;
    const result = extractFrameDetails({
      error: e,
      sourceLineno: 5,
      sourceColno: 10,
      currentPath: 'test.html',
      hasIncludeChain: true,
    });
    expect(result).toBeNull();
  });

  test('returns null when lineBase is zero or one', () => {
    const e = { message: 'test', lineno: 5, lineBase: 'zero' } as ErrorWithLineInfo;
    const result = extractFrameDetails({
      error: e,
      sourceLineno: 5,
      sourceColno: 10,
      currentPath: 'test.html',
      hasIncludeChain: false,
    });
    expect(result).toBeNull();
  });

  test('returns null when sourceLineno is undefined', () => {
    const e = { message: 'test' } as ErrorWithLineInfo;
    const result = extractFrameDetails({
      error: e,
      sourceLineno: undefined,
      sourceColno: 10,
      currentPath: 'test.html',
      hasIncludeChain: false,
    });
    expect(result).toBeNull();
  });

  test('returns null when sourceLineno is negative', () => {
    const e = { message: 'test', lineno: -1 } as ErrorWithLineInfo;
    const result = extractFrameDetails({
      error: e,
      sourceLineno: -1,
      sourceColno: 10,
      currentPath: 'test.html',
      hasIncludeChain: false,
    });
    expect(result).toBeNull();
  });

  test('extracts error with proper location', () => {
    const e = {
      message: 'test error',
      lineno: 5,
      colno: 10,
      getterName: 'root',
    } as ErrorWithLineInfo;
    const result = extractFrameDetails({
      error: e,
      sourceLineno: 5,
      sourceColno: undefined,
      currentPath: 'test.html',
      hasIncludeChain: false,
    });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('[Line 5, Column 10]');
  });
});

describe('createTemplateErrorHandler', () => {
  test('enrichError returns original when lineBase is zero', () => {
    const getState = () => ({ path: 'test.html', includeChain: null });
    const handler = createTemplateErrorHandler(getState);
    const e = { message: 'test', lineBase: 'zero' } as ErrorWithLineInfo;
    const result = handler.enrichError(e);
    expect(result).not.toBe(e);
    expect((result as unknown as { path: string }).path).toBe('test.html');
  });

  test('enrichError returns enriched error when has includeChain', () => {
    const getState = () => ({ path: 'test.html', includeChain: null });
    const handler = createTemplateErrorHandler(getState);
    const e = {
      message: 'test',
      includeChain: [{ path: 'base.html' }],
    } as unknown as ErrorWithLineInfo;
    const result = handler.enrichError(e);
    expect(result).not.toBeNull();
    expect((result as unknown as { path: string }).path).toBe('test.html');
  });

  test('enrichError returns extracted error with lineno when provided', () => {
    const getState = () => ({ path: 'test.html', includeChain: null });
    const handler = createTemplateErrorHandler(getState);
    const e = { message: 'test', lineno: 5 } as ErrorWithLineInfo;
    const result = handler.enrichError(e);
    expect(result).not.toBeNull();
    expect((result as unknown as { lineno: number }).lineno).toBe(5);
  });

  test('enrichError clone cannot be prototype-retargeted by a hostile thrown object', () => {
    const getState = () => ({ path: 'test.html', includeChain: null });
    const handler = createTemplateErrorHandler(getState);
    // WHY: JSON.parse yields a genuine own enumerable "__proto__" data property — the
    // exact shape [[Set]]-based cloning (Object.assign) would forward to the
    // Object.prototype prototype setter, retargeting the clone.
    const hostile = JSON.parse('{"message":"boom","__proto__":{"pwned":true}}');
    const result = handler.enrichError(hostile as ErrorWithLineInfo);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as unknown as Record<string, unknown>)['__proto__']).toStrictEqual({
      pwned: true,
    });
    expect((result as unknown as { path: string }).path).toBe('test.html');
  });

  test('enrichError preserves a real Error non-enumerable message and stack on the clone', () => {
    // WHY: regression — the clone spread only own enumerable props, so a genuine
    // Error's non-enumerable `message`/`stack` were dropped and the enriched error
    // rendered with an empty message (plain-object error-likes masked this).
    const getState = () => ({ path: 'test.html', includeChain: null });
    const handler = createTemplateErrorHandler(getState);
    const e = Object.assign(new Error('boom'), {
      code: 'RENDER_FAIL',
    }) as unknown as ErrorWithLineInfo;
    const result = handler.enrichError(e);
    expect(result).not.toBe(e);
    expect(result.message).toBe('boom');
    expect(result.stack).toBe(e.stack);
    expect((result as unknown as { path: string }).path).toBe('test.html');
    expect((result as unknown as { code: string }).code).toBe('RENDER_FAIL');
  });
});

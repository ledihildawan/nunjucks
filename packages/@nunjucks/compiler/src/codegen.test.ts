import { describe, expect, test } from 'bun:test';
import {
  assertSafeIdentifier,
  emitLineLocation,
  emitLocationGuard,
  getTemplateName,
  nextCompilerId,
} from './codegen.ts';
import { makeCodegenCompiler } from './test-helpers.ts';

describe('nextCompilerId', () => {
  test('returns t_N format and increments', () => {
    const ctx = makeCodegenCompiler();
    expect(nextCompilerId(ctx)).toBe('t_1');
    expect(nextCompilerId(ctx)).toBe('t_2');
    expect(ctx.lastId).toBe(2);
  });
});

describe('emitLocationGuard', () => {
  test('emits comma-operator location guard', () => {
    const ctx = makeCodegenCompiler();
    emitLocationGuard(ctx, 5, 10);
    expect(ctx.codebuf).toEqual(['(lineno = 5, colno = 10, ']);
  });
});

describe('emitLineLocation', () => {
  test('emits statement-style location', () => {
    const ctx = makeCodegenCompiler();
    emitLineLocation(ctx, 3, 7);
    expect(ctx.codebuf).toEqual(['lineno = 3; colno = 7;\n']);
    expect(ctx.compiledLine).toBe(1);
  });
});

describe('getTemplateName', () => {
  test('returns JSON-stringified name', () => {
    expect(getTemplateName({ templateName: 'file.njk' })).toBe('"file.njk"');
  });
  test('returns "undefined" for null', () => {
    expect(getTemplateName({ templateName: null })).toBe('undefined');
  });
  test('returns "undefined" for undefined', () => {
    expect(getTemplateName({ templateName: undefined })).toBe('undefined');
  });
});

describe('code-injection boundary', () => {
  // WHY: these two checks are the PRIMARY defenses feeding the single `new Function`
  // execution boundary (runtime/src/shell/code-loader.ts) — pin them adversarially so
  // emit-site discipline can never silently regress into raw interpolation.
  const compiler = { templateName: 'boundary.test' };

  describe('assertSafeIdentifier', () => {
    test('accepts the full legitimate identifier charset', () => {
      expect(assertSafeIdentifier('safe_$ident1', { compiler })).toBeUndefined();
    });

    test('rejects quote-breakout payloads from template-derived names', () => {
      // WHY: the lexer deliberately accepts symbol runs like a";evil — the codegen
      // boundary is where those must fail closed instead of reaching an identifier slot.
      expect(() => assertSafeIdentifier('a";evil', { compiler })).toThrow();
      expect(() => assertSafeIdentifier("a'-backquote", { compiler })).toThrow();
    });

    test('rejects path, whitespace, and newline shapes', () => {
      expect(() => assertSafeIdentifier('../fs', { compiler })).toThrow();
      expect(() => assertSafeIdentifier('a b', { compiler })).toThrow();
      expect(() => assertSafeIdentifier('a\nb', { compiler })).toThrow();
      expect(() => assertSafeIdentifier('a\\b', { compiler })).toThrow();
    });

    test('rejects empty and leading-digit shapes', () => {
      expect(() => assertSafeIdentifier('', { compiler })).toThrow();
      expect(() => assertSafeIdentifier('1abc', { compiler })).toThrow();
    });
  });

  describe('getTemplateName string-literal emission', () => {
    test('a hostile template name cannot break out of the emitted literal', () => {
      const hostile = '");evil();("';
      // WHY: exact JSON.stringify equality proves the name is emitted as one opaque
      // string literal — every embedded quote is backslash-escaped, so no raw
      // interpolation path exists.
      expect(getTemplateName({ templateName: hostile })).toBe(JSON.stringify(hostile));
    });

    test('backslash and newline payloads stay inside the literal', () => {
      const hostile = 'a\\b\nc\td';
      expect(getTemplateName({ templateName: hostile })).toBe(JSON.stringify(hostile));
    });
  });
});

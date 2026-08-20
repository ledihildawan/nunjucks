import { describe, expect, test } from 'bun:test';
import { emitLineLocation, emitLocationGuard, getTemplateName, nextCompilerId } from './codegen.ts';
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

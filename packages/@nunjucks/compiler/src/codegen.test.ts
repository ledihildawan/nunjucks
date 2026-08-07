import { describe, test, expect } from 'bun:test';
import { tmpid, emitLocationGuard, emitLineLocation, getTemplateName } from './codegen.ts';
import type { Compiler } from './index.ts';

const mockCompiler = (overrides: Partial<Compiler> = {}): Compiler => ({
  templateName: 'test',
  codebuf: [],
  lastId: 0,
  buffer: null,
  bufferStack: [],
  scopeStack: [],
  inBlock: false,
  undefinedMode: 'chainable',
  compiledLine: 0,
  fail: () => { throw new Error('fail'); },
  pushBuffer: () => '',
  popBuffer: () => {},
  emit: (_code: string) => {},
  emitLine: (_code: string) => {},
  emitLines: () => {},
  emitFuncBegin: () => {},
  emitFuncEnd: () => {},
  addScopeLevel: () => {},
  closeScopeLevels: () => {},
  withScopedSyntax: () => {},
  tmpid: () => 't_x',
  getTemplateName: () => '"test"',
  compileChildren: () => {},
  compileExpression: () => {},
  assertType: () => {},
  compile: () => {},
  getCode: () => '',
  getHtmlContext: () => ({ context: 'text' }) as never,
  ...overrides,
}) as Compiler;

describe('tmpid', () => {
  test('returns t_N format and increments', () => {
    const ctx = { lastId: 0 };
    expect(tmpid(ctx)).toBe('t_1');
    expect(tmpid(ctx)).toBe('t_2');
    expect(ctx.lastId).toBe(2);
  });
});

describe('emitLocationGuard', () => {
  test('emits comma-operator location guard', () => {
    const emitted: string[] = [];
    const ctx = mockCompiler({ emit: (code: string) => { emitted.push(code); } });
    emitLocationGuard(ctx, 5, 10);
    expect(emitted).toEqual(['(lineno = 5, colno = 10, ']);
  });
});

describe('emitLineLocation', () => {
  test('emits statement-style location', () => {
    const emitted: string[] = [];
    const ctx = mockCompiler({ emitLine: (code: string) => { emitted.push(code); } });
    emitLineLocation(ctx, 3, 7);
    expect(emitted).toEqual(['lineno = 3; colno = 7;']);
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
    expect(getTemplateName({ templateName: null })).toBe('undefined');
  });
});

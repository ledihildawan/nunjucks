import { describe, test, expect, mock } from 'bun:test';
import {
  emit, emitLine, emitLineWithMapping, emitLineWithLineno, emitLines,
  pushBuffer, popBuffer, tmpid, addScopeLevel, closeScopeLevels,
  withScopedSyntax, templateNameStr, emitFuncBegin, emitFuncEnd,
} from './emitters.js';

const makeCtx = () => ({
  templateName: 't.html',
  codebuf: [],
  lastId: 0,
  buffer: null,
  bufferStack: [],
  _scopeClosers: '',
  compiledLine: 0,
  sourceMap: { addMapping: mock(() => {}) },
});

describe('emit', () => {
  test('pushes code to buffer', () => {
    const ctx = makeCtx();
    emit(ctx, 'hello');
    expect(ctx.codebuf).toEqual(['hello']);
  });
});

describe('emitLine', () => {
  test('appends newline and increments compiledLine', () => {
    const ctx = makeCtx();
    emitLine(ctx, 'var x = 1', 5);
    expect(ctx.compiledLine).toBe(1);
    expect(ctx.codebuf).toEqual(['var x = 1\n']);
    expect(ctx.sourceMap.addMapping).toHaveBeenCalledWith(1, 5);
  });

  test('skips addMapping when originalLine is null', () => {
    const ctx = makeCtx();
    emitLine(ctx, 'var x = 1', null);
    expect(ctx.sourceMap.addMapping).not.toHaveBeenCalled();
  });

  test('skips addMapping when originalLine is undefined', () => {
    const ctx = makeCtx();
    emitLine(ctx, 'var x = 1');
    expect(ctx.sourceMap.addMapping).not.toHaveBeenCalled();
  });
});

describe('emitLineWithMapping', () => {
  test('adds mapping with templateLine + 1', () => {
    const ctx = makeCtx();
    emitLineWithMapping(ctx, 'code', 3, 5);
    expect(ctx.compiledLine).toBe(1);
    expect(ctx.codebuf).toEqual(['code\n']);
    expect(ctx.sourceMap.addMapping).toHaveBeenCalledWith(1, 4, 5);
  });

  test('skips mapping when templateLine is undefined', () => {
    const ctx = makeCtx();
    emitLineWithMapping(ctx, 'code');
    expect(ctx.sourceMap.addMapping).not.toHaveBeenCalled();
  });
});

describe('emitLineWithLineno', () => {
  test('adds mapping with templateLine + 1', () => {
    const ctx = makeCtx();
    emitLineWithLineno(ctx, 'code', 2, 3);
    expect(ctx.compiledLine).toBe(1);
    expect(ctx.codebuf).toEqual(['code\n']);
    expect(ctx.sourceMap.addMapping).toHaveBeenCalledWith(1, 3, 3);
  });
});

describe('emitLines', () => {
  test('emits each line', () => {
    const ctx = makeCtx();
    emitLines(ctx, 'a', 'b', 'c');
    expect(ctx.codebuf).toEqual(['a\n', 'b\n', 'c\n']);
  });
});

describe('pushBuffer / popBuffer', () => {
  test('pushBuffer creates new buffer variable and pushes stack', () => {
    const ctx = makeCtx();
    ctx.buffer = 'output';
    const id = pushBuffer(ctx);
    expect(id).toBe('t_1');
    expect(ctx.buffer).toBe('t_1');
    expect(ctx.bufferStack).toEqual(['output']);
    expect(ctx.codebuf[0]).toContain('var t_1');
  });

  test('popBuffer restores previous buffer', () => {
    const ctx = makeCtx();
    ctx.buffer = 't_1';
    ctx.bufferStack.push('output');
    popBuffer(ctx);
    expect(ctx.buffer).toBe('output');
  });
});

describe('tmpid', () => {
  test('generates incrementing ids', () => {
    const ctx = makeCtx();
    expect(tmpid(ctx)).toBe('t_1');
    expect(tmpid(ctx)).toBe('t_2');
    expect(ctx.lastId).toBe(2);
  });
});

describe('addScopeLevel / closeScopeLevels', () => {
  test('addScopeLevel appends )}', () => {
    const ctx = makeCtx();
    addScopeLevel(ctx);
    expect(ctx._scopeClosers).toBe('})');
  });

  test('closeScopeLevels emits and clears', () => {
    const ctx = makeCtx();
    ctx._scopeClosers = '})';
    closeScopeLevels(ctx);
    expect(ctx.codebuf[0]).toContain('})');
    expect(ctx._scopeClosers).toBe('');
  });

  test('closeScopeLevels does nothing when empty', () => {
    const ctx = makeCtx();
    closeScopeLevels(ctx);
    expect(ctx.codebuf).toEqual([]);
  });
});

describe('withScopedSyntax', () => {
  test('saves and restores scope closers', () => {
    const ctx = makeCtx();
    ctx._scopeClosers = '}}';
    withScopedSyntax(ctx, () => {
      expect(ctx._scopeClosers).toBe('');
    });
    expect(ctx._scopeClosers).toBe('}}');
  });
});

describe('templateNameStr', () => {
  test('stringifies template name', () => {
    expect(templateNameStr({ templateName: 'foo' })).toBe('"foo"');
  });

  test('returns undefined for null name', () => {
    expect(templateNameStr({ templateName: null })).toBe('undefined');
  });
});

describe('emitFuncBegin / emitFuncEnd', () => {
  test('emitFuncBegin starts async function', () => {
    const ctx = makeCtx();
    emitFuncBegin(ctx, { lineno: 1, colno: 0 }, 'renderIt');
    const output = ctx.codebuf.join('');
    expect(output).toContain('async function renderIt');
    expect(output).toContain('lineno = 1');
    expect(output).toContain('colno = 0');
    expect(output).toContain('try {');
    expect(ctx.buffer).toBe('output');
  });

  test('emitFuncEnd closes function', () => {
    const ctx = makeCtx();
    ctx.buffer = 'output';
    emitFuncEnd(ctx);
    const output = ctx.codebuf.join('');
    expect(output).toContain('return output;');
    expect(output).toContain('} catch (e) {');
    expect(output).toContain('throw runtime.handleError(e, lineno, colno);');
    expect(ctx.buffer).toBeNull();
  });

  test('emitFuncEnd skips return when noReturn is true', () => {
    const ctx = makeCtx();
    ctx.buffer = 'output';
    emitFuncEnd(ctx, true);
    expect(ctx.codebuf.join('')).not.toContain('return output;');
  });
});

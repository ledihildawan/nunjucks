import { describe, test, expect, beforeEach } from 'bun:test';
import { createCompiler, compile, getSourceMap, getSourceMapFromCompile } from './index.js';
import { NodeList, Literal, AstSymbol } from '../nodes/index.js';
import { createFrame } from '../runtime/index.js';

let compiler;

beforeEach(() => {
  compiler = createCompiler('test.njk', 'chainable', 'source');
});

describe('Compiler', () => {
  test('init sets properties', () => {
    expect(compiler.templateName).toBe('test.njk');
    expect(compiler.codebuf).toEqual([]);
    expect(compiler.lastId).toBe(0);
    expect(compiler.buffer).toBeNull();
    expect(compiler.bufferStack).toEqual([]);
    expect(compiler._scopeClosers).toBe('');
    expect(compiler.inBlock).toBe(false);
    expect(compiler.undefinedMode).toBe('chainable');
    expect(compiler.compiledLine).toBe(0);
    expect(compiler.sourceMap).toBeDefined();
  });

  test('fail throws TemplateError', () => {
    expect(() => compiler.fail('msg', 1, 2)).toThrow();
    expect(() => compiler.fail('msg', 1, 2)).toThrow('msg');
  });

  test('_pushBuffer creates new buffer variable', () => {
    const id = compiler._pushBuffer();
    expect(id).toBe('t_1');
    expect(compiler.codebuf[0]).toBe('var t_1 = "";');
    expect(compiler.buffer).toBe('t_1');
  });

  test('_popBuffer restores previous buffer', () => {
    compiler._pushBuffer();
    compiler._pushBuffer();
    compiler._popBuffer();
    expect(compiler.buffer).toBe('t_1');
  });

  test('_emit pushes code', () => {
    compiler._emit('hello');
    expect(compiler.codebuf).toEqual(['hello']);
  });

  test('_emitLine adds line with newline', () => {
    compiler._emitLine('hello');
    expect(compiler.codebuf).toEqual(['hello\n']);
    expect(compiler.compiledLine).toBe(1);
  });

  test('_emitLine adds source mapping when originalLine given', () => {
    const initialLen = compiler.sourceMap.mappings.length;
    compiler._emitLine('hello', 5);
    expect(compiler.sourceMap.mappings.length).toBe(initialLen + 1);
    expect(compiler.sourceMap.mappings[initialLen].compiledLine).toBe(1);
    expect(compiler.sourceMap.mappings[initialLen].originalLine).toBe(5);
  });

  test('_emitLineWithMapping emits with templateLine+1 mapping', () => {
    const initialLen = compiler.sourceMap.mappings.length;
    compiler._emitLineWithMapping('code', 3, 7);
    expect(compiler.sourceMap.mappings.length).toBe(initialLen + 1);
    expect(compiler.sourceMap.mappings[initialLen].originalLine).toBe(4);
    expect(compiler.codebuf[0]).toBe('code\n');
  });

  test('_trackMapping adds mapping without emitting', () => {
    const initialLen = compiler.sourceMap.mappings.length;
    compiler._trackMapping(3, 7);
    expect(compiler.sourceMap.mappings.length).toBe(initialLen + 1);
    expect(compiler.codebuf.length).toBe(0);
  });

  test('_emitLines emits multiple lines', () => {
    compiler._emitLines('a', 'b', 'c');
    expect(compiler.codebuf).toEqual(['a\n', 'b\n', 'c\n']);
  });

  test('_emitFuncBegin starts root function', () => {
    const node = NodeList(1, 2);
    compiler._emitFuncBegin(node, 'root');
    expect(compiler.buffer).toBe('output');
    expect(compiler.codebuf[0]).toContain('async function root');
    expect(compiler.codebuf[1]).toContain('var lineno = 1');
    expect(compiler.codebuf[2]).toContain('var colno = 2');
  });

  test('_emitFuncEnd returns buffer and closes', () => {
    compiler.buffer = 'output';
    compiler._emitFuncEnd();
    const code = compiler.getCode();
    expect(code).toContain('return output;');
    expect(code).toContain('runtime.handleError');
    expect(compiler.buffer).toBeNull();
  });

  test('_emitFuncEnd with noReturn skips return', () => {
    compiler.buffer = 'output';
    compiler._emitFuncEnd(true);
    expect(compiler.getCode()).not.toContain('return output;');
  });

  test('_addScopeLevel adds closers', () => {
    compiler._addScopeLevel();
    expect(compiler._scopeClosers).toBe('})');
  });

  test('_closeScopeLevels emits closers and resets', () => {
    compiler._scopeClosers = '})';
    compiler._closeScopeLevels();
    expect(compiler.codebuf).toContain('});\n');
    expect(compiler._scopeClosers).toBe('');
  });

  test('_withScopedSyntax wraps function', () => {
    compiler._withScopedSyntax(() => {
      compiler._emitLine('body');
    });
    expect(compiler.codebuf.length).toBeGreaterThan(0);
  });

  test('_tmpid generates incrementing ids', () => {
    expect(compiler._tmpid()).toBe('t_1');
    expect(compiler._tmpid()).toBe('t_2');
    expect(compiler.lastId).toBe(2);
  });

  test('_templateName returns JSON string', () => {
    expect(compiler._templateName()).toBe('"test.njk"');
  });

  test('_templateName returns undefined for null name', () => {
    const c = createCompiler(null, false, '');
    expect(c._templateName()).toBe('undefined');
  });

  test('_compileChildren compiles each child', () => {
    const child1 = Literal(1, 1, 'hello');
    const child2 = Literal(1, 1, 'world');
    const node = NodeList(1, 1, [child1, child2]);
    const frame = createFrame();
    compiler._compileChildren(node, frame);
    expect(compiler.codebuf.length).toBeGreaterThan(0);
  });

  test('_compileExpression compiles valid expression', () => {
    const node = Literal(1, 1, 42);
    compiler._compileExpression(node, createFrame());
    expect(compiler.codebuf.length).toBeGreaterThan(0);
  });

  test('_compileExpression throws for invalid type', () => {
    const invalidNode = { typename: 'Unknown', lineno: 1, colno: 1 };
    expect(() => compiler._compileExpression(invalidNode, createFrame())).toThrow();
  });

  test('assertType passes for matching type', () => {
    expect(() => compiler.assertType(Literal(1, 1, 'x'), Literal)).not.toThrow();
  });

  test('assertType throws for non-matching type', () => {
    expect(() => compiler.assertType(AstSymbol(1, 1, 'x'), Literal)).toThrow('assertType');
  });

  test('compile delegates to compileDispatch', () => {
    const node = Literal(1, 1, 'hello');
    compiler.compile(node, createFrame());
    expect(compiler.codebuf.length).toBeGreaterThan(0);
  });

  test('getCode joins codebuf', () => {
    compiler._emit('a');
    compiler._emit('b');
    expect(compiler.getCode()).toBe('ab');
  });

  test('getSourceMap returns sourceMap', () => {
    expect(compiler.getSourceMap()).toBe(compiler.sourceMap);
  });
});

describe('compile function', () => {
  test('compiles template string to JS code', () => {
    const result = compile('Hello {{ name }}', [], [], 'test.njk');
    expect(result).toContain('async function root');
    expect(result).toContain('runtime.suppressValue');
  });

  test('compiles with async pipes', () => {
    const result = compile('Hello {{ x }}', ['upper'], [], 'test.njk');
    expect(result).toContain('async function root');
  });

  test('compiles with extensions', () => {
    const ext = { preprocess: (s) => s };
    const result = compile('Hello', [], [ext], 'test.njk');
    expect(result).toContain('async function root');
  });

  test('compiles with opts', () => {
    const result = compile('{{ x }}', [], [], 'test.njk', { undefined: 'strict' });
    expect(result).toContain('ensureDefined');
  });

  test('result can be evaluated as function', () => {
    const result = compile('Hello world', [], [], 'test.njk');
    const func = new Function(result);
    const props = func();
    expect(props.root).toBeFunction();
  });
});

describe('getSourceMap', () => {
  test('returns sourceMap from compiler', () => {
    const c = createCompiler('test.njk', false, '');
    expect(getSourceMap(c)).toBe(c.sourceMap);
  });
});

describe('getSourceMapFromCompile', () => {
  test('compiles and returns source map', () => {
    const sm = getSourceMapFromCompile('Hello', [], [], 'test.njk');
    expect(sm).toBeDefined();
    expect(sm.templateName).toBe('test.njk');
    expect(sm.mappings).toBeArray();
  });
});

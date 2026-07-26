import { describe, test, expect } from 'bun:test';
import { compileDispatch, COMPILE_FUNCTIONS } from './node-dispatch.ts';
import type { Compiler } from './index.ts';
import type { Frame } from '@nunjucks/runtime';
import { literal, symbol, add, nodeList, getNodeTypeName } from '@nunjucks/nodes';
import type { NodeType } from '@nunjucks/nodes';

const makeCtx = (): Compiler & { emitted: string[] } => {
  const emitted: string[] = [];
  const ctx = {
    emitted,
    buffer: 'output',
    undefinedMode: 'chainable',
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compileChildren: (node: { children?: unknown[] }, frame?: unknown) =>
      (node.children ?? []).forEach((c) => compileDispatch(ctx, c as never, frame as Frame)),
    fail: (msg: string) => { throw new Error(msg); },
  } as unknown as Compiler & { emitted: string[] };
  ctx.compile = ((node: unknown, frame?: unknown) => compileDispatch(ctx, node as never, frame as Frame)) as Compiler['compile'];
  ctx.compileExpression = ctx.compile;
  return ctx;
};

const makeFrame = (): Frame => ({ lookup: () => null } as unknown as Frame);

describe('COMPILE_FUNCTIONS', () => {
  const expectedTypes: NodeType[] = [
    'node', 'value', 'literal', 'symbol', 'group', 'array', 'dict', 'nodeList',
    'pair', 'inlineIf', 'walrus', 'in', 'is', 'or', 'and', 'nullishCoalesce',
    'add', 'concat', 'sub', 'mul', 'div', 'mod', 'not', 'floorDiv', 'pow',
    'neg', 'pos', 'spread', 'templateLiteral', 'compare', 'bitwiseOr', 'bitwiseAnd',
    'bitwiseXor', 'bitwiseLShift', 'bitwiseRShift', 'bitwiseNot', 'increment',
    'decrement', 'lookupVal', 'optionalChain', 'optionalCall', 'slice', 'funCall',
    'pipe', 'keywordArgs', 'variableDeclaration', 'variableAssignment',
    'compoundAssignment', 'defineBlock', 'switch', 'if', 'for', 'macro', 'caller',
    'import', 'fromImport', 'block', 'super', 'extends', 'include', 'templateData',
    'capture', 'output', 'callExtension', 'callExtensionAsync', 'root', 'do', 'with',
  ];

  test('has an entry for every major node type', () => {
    expectedTypes.forEach((t) => {
      expect(COMPILE_FUNCTIONS[t]).toBeFunction();
    });
  });

  test('entry count matches expected set', () => {
    expect(Object.keys(COMPILE_FUNCTIONS).sort()).toEqual([...expectedTypes].sort());
  });
});

describe('compileDispatch', () => {
  test('dispatches string literal to compileLiteral', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, literal(1, 1, 'hi'), makeFrame());
    expect((ctx.emitted as string[]).join('')).toBe('"hi"');
  });

  test('dispatches number literal to compileLiteral', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, literal(1, 1, 42), makeFrame());
    expect((ctx.emitted as string[]).join('')).toBe('42');
  });

  test('dispatches null literal to compileLiteral', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, literal(1, 1, null), makeFrame());
    expect((ctx.emitted as string[]).join('')).toBe('null');
  });

  test('dispatches symbol via frame lookup when defined', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, symbol(1, 1, 'x'), { lookup: () => 't_var' } as unknown as Frame);
    expect((ctx.emitted as string[]).join('')).toBe('t_var');
  });

  test('dispatches symbol to context lookup when not in frame', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, symbol(1, 1, 'x'), { lookup: () => null } as unknown as Frame);
    const out = (ctx.emitted as string[]).join('');
    expect(out).toContain('contextOrFrameLookup');
    expect(out).toContain('"x"');
  });

  test('dispatches add with recursive compilation of children', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, add(1, 2, literal(1, 1, 1), literal(1, 1, 2)), makeFrame());
    expect((ctx.emitted as string[]).join('')).toBe('(lineno = 1, colno = 2, 1 + 2)');
  });

  test('dispatches nodeList compiling each child', () => {
    const ctx = makeCtx();
    compileDispatch(ctx, nodeList(1, 1, [literal(1, 1, 'a'), literal(1, 1, 'b')]), makeFrame());
    expect((ctx.emitted as string[]).join('')).toBe('"a""b"');
  });

  test('passes frame through to the compile function', () => {
    const ctx = makeCtx();
    let receivedFrame: unknown = 'untouched';
    const original = COMPILE_FUNCTIONS.literal;
    (COMPILE_FUNCTIONS as Record<string, unknown>).literal = (_c: unknown, _n: unknown, frame: unknown) => {
      receivedFrame = frame;
    };
    const frame = makeFrame();
    compileDispatch(ctx, literal(1, 1, 1), frame);
    (COMPILE_FUNCTIONS as Record<string, unknown>).literal = original;
    expect(receivedFrame).toBe(frame);
  });

  test('returns the result of the compile function', () => {
    const ctx = makeCtx();
    const original = COMPILE_FUNCTIONS.literal;
    (COMPILE_FUNCTIONS as unknown as Record<string, () => number>).literal = () => 123;
    const result = compileDispatch(ctx, literal(1, 1, 1), makeFrame());
    (COMPILE_FUNCTIONS as Record<string, unknown>).literal = original;
    expect(result).toBe(123);
  });

  test('calls ctx.fail and returns undefined for unknown node type', () => {
    const ctx = makeCtx();
    let failedMsg = '';
    ctx.fail = (msg: string) => { failedMsg = msg; };
    const unknown = { type: 'totallyUnknown', lineno: 7, colno: 9 };
    const result = compileDispatch(ctx, unknown as never, makeFrame());
    expect(failedMsg).toContain('compile: Cannot compile node');
    expect(failedMsg).toContain('totallyUnknown');
    expect(result).toBeUndefined();
  });

  test('uses getNodeTypeName to resolve the dispatch key', () => {
    const node = literal(1, 1, 'x');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(COMPILE_FUNCTIONS[getNodeTypeName(node) as NodeType]).toBeFunction();
  });
});

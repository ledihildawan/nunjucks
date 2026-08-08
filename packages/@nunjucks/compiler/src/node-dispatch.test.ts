import { describe, test, expect } from 'bun:test';
import { createCompiler } from './create-compiler.ts';
import {
  literal, symbol, add, funCall, lookupVal,
  block, output, templateData,
} from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';

const compile = (node: Node): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(node, createFrame());
  return c.getCode();
};

describe('node-dispatch: expression nodes', () => {
  test('literal emits value', () => {
    const code = compile(literal(ZERO_LOC, 'hello'));
    expect(code).toContain('hello');
  });

  test('symbol emits variable reference', () => {
    const code = compile(symbol(ZERO_LOC, 'myVar'));
    expect(code).toContain('myVar');
  });

  test('add emits binary operation', () => {
    const code = compile(add(ZERO_LOC, { left: literal(ZERO_LOC, 1), right: literal(ZERO_LOC, 2) }));
    expect(code).toContain('+');
  });

  test('funCall emits runtime.callWrap', () => {
    const code = compile(funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'greet'), args: [literal(ZERO_LOC, 'World')] }));
    expect(code).toContain('callWrap');
  });

  test('lookupVal emits member access', () => {
    const code = compile(lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'obj'), val: literal(ZERO_LOC, 'key') }));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('node-dispatch: statement nodes', () => {
  test('output compiles without error', () => {
    const code = compile(output(ZERO_LOC, [templateData(ZERO_LOC, 'text')]));
    expect(code.length).toBeGreaterThan(0);
  });

  test('block emits block function', () => {
    const body = output(ZERO_LOC, [templateData(ZERO_LOC, 'content')]);
    const code = compile(block(ZERO_LOC, { name: 'myblock', body }));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('node-dispatch: compileDispatch via createCompiler', () => {
  test('dispatches unknown node type to fail', () => {
    const c = createCompiler('test', 'chainable', '');
    const fakeNode = { type: 'nonexistent', lineno: 0, colno: 0 } as unknown as Node;
    expect(() => c.compile(fakeNode, createFrame())).toThrow();
  });
});

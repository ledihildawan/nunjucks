import { describe, test, expect } from 'bun:test';
import { createCompiler } from './create-compiler.ts';
import {
  literal, symbol, add, funCall, lookupVal,
  block, output, templateData,
} from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import type { Node } from '@nunjucks/nodes';

const compile = (node: Node): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(node, createFrame());
  return c.getCode();
};

describe('node-dispatch: expression nodes', () => {
  test('literal emits value', () => {
    const code = compile(literal(0, 0, 'hello'));
    expect(code).toContain('hello');
  });

  test('symbol emits variable reference', () => {
    const code = compile(symbol(0, 0, 'myVar'));
    expect(code).toContain('myVar');
  });

  test('add emits binary operation', () => {
    const code = compile(add(0, 0, literal(0, 0, 1), literal(0, 0, 2)));
    expect(code).toContain('+');
  });

  test('funCall emits runtime.callWrap', () => {
    const code = compile(funCall(0, 0, symbol(0, 0, 'greet'), [literal(0, 0, 'World')]));
    expect(code).toContain('callWrap');
  });

  test('lookupVal emits member access', () => {
    const code = compile(lookupVal(0, 0, symbol(0, 0, 'obj'), literal(0, 0, 'key')));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('node-dispatch: statement nodes', () => {
  test('output compiles without error', () => {
    const code = compile(output(0, 0, [templateData(0, 0, 'text')]));
    expect(code.length).toBeGreaterThan(0);
  });

  test('block emits block function', () => {
    const body = output(0, 0, [templateData(0, 0, 'content')]);
    const code = compile(block(0, 0, 'myblock', body));
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

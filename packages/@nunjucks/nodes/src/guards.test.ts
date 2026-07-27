import { describe, test, expect } from 'bun:test';
import { value, literal, symbol, nodeList, root, funCall, lookupVal, add, if_, for_ } from '@nunjucks/nodes';
import {
  isNode, isLiteral, isSymbol, isNodeList, isRoot, isFunCall, isLookupVal,
  isAdd, isIf, isFor, isValue, isFilter, isPipe,
} from './types/guards.ts';
import { pipe } from '@nunjucks/nodes/factory';

describe('isNode', () => {
  test('recognizes AST nodes', () => {
    expect(isNode(literal(0, 0, 'x'))).toBe(true);
    expect(isNode(value(0, 0, 42))).toBe(true);
  });

  test('rejects non-nodes', () => {
    expect(isNode(null)).toBe(false);
    expect(isNode(undefined)).toBe(false);
    expect(isNode('string')).toBe(false);
    expect(isNode(42)).toBe(false);
    expect(isNode({})).toBe(false);
  });

  test('rejects objects with an unknown node type', () => {
    expect(isNode({ type: 'not-a-nunjucks-node', lineno: 0, colno: 0 })).toBe(false);
  });
});

describe('type-specific guards', () => {
  test('isLiteral', () => {
    expect(isLiteral(literal(0, 0, 'x'))).toBe(true);
    expect(isLiteral(symbol(0, 0, 'x'))).toBe(false);
  });

  test('isSymbol', () => {
    expect(isSymbol(symbol(0, 0, 'name'))).toBe(true);
    expect(isSymbol(literal(0, 0, 'x'))).toBe(false);
  });

  test('isValue', () => {
    expect(isValue(value(0, 0, 42))).toBe(true);
    expect(isValue(literal(0, 0, 'x'))).toBe(false);
  });

  test('isRoot', () => {
    expect(isRoot(root(0, 0))).toBe(true);
    expect(isRoot(literal(0, 0, 'x'))).toBe(false);
  });

  test('isNodeList', () => {
    expect(isNodeList(nodeList(0, 0))).toBe(true);
  });

  test('isFunCall', () => {
    const fn = funCall(0, 0, symbol(0, 0, 'fn'), []);
    expect(isFunCall(fn)).toBe(true);
  });

  test('isLookupVal', () => {
    const lv = lookupVal(0, 0, symbol(0, 0, 'obj'), literal(0, 0, 'prop'));
    expect(isLookupVal(lv)).toBe(true);
  });

  test('isAdd', () => {
    const expr = add(0, 0, literal(0, 0, 1), literal(0, 0, 2));
    expect(isAdd(expr)).toBe(true);
  });

  test('isIf', () => {
    const n = if_(0, 0, { cond: literal(0, 0, true), body: nodeList(0, 0), else_: null });
    expect(isIf(n)).toBe(true);
  });

  test('isFor', () => {
    const n = for_(0, 0, { arr: symbol(0, 0, 'i'), name: symbol(0, 0, 'items'), body: nodeList(0, 0), else_: nodeList(0, 0) });
    expect(isFor(n)).toBe(true);
  });
});

describe('composite guards', () => {
  test('isFilter matches pipe nodes', () => {
    const p = pipe(0, 0, symbol(0, 0, 'x'), [symbol(0, 0, 'upper')]);
    expect(isPipe(p)).toBe(true);
    expect(isFilter(p)).toBe(true);
  });
});

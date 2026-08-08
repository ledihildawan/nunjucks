import { describe, test, expect } from 'bun:test';
import { ZERO_LOC } from '@nunjucks/shared';
import {
  root, output, literal, symbol, templateData,
  add, ifNode, funCall, lookupVal, block,
  isBlock, isFunCall, isLookupVal, isSymbol,
} from './index.ts';

describe('factory: node creation', () => {
  test('literal creates value node', () => {
    const n = literal(ZERO_LOC, 'hello');
    expect(n.type).toBe('literal');
    expect(n.value).toBe('hello');
    expect(n.lineno).toBe(0);
  });

  test('symbol creates symbol node', () => {
    const n = symbol(ZERO_LOC, 'x');
    expect(n.type).toBe('symbol');
    expect(n.value).toBe('x');
  });

  test('add creates binary op node', () => {
    const left = literal(ZERO_LOC, 1);
    const right = literal(ZERO_LOC, 2);
    const n = add(ZERO_LOC, { left, right });
    expect(n.type).toBe('add');
    expect(n.operator).toBe('+');
  });

  test('block creates block node with name and body', () => {
    const body = output(ZERO_LOC, [templateData(ZERO_LOC, 'hi')]);
    const n = block(ZERO_LOC, { name: 'content', body });
    expect(n.type).toBe('block');
    expect(n.name).toBe('content');
  });

  test('funCall creates call node', () => {
    const name = symbol(ZERO_LOC, 'greet');
    const n = funCall(ZERO_LOC, { name, args: [] });
    expect(n.type).toBe('funCall');
    expect(n.args).toEqual([]);
  });

  test('lookupVal creates lookup node', () => {
    const target = symbol(ZERO_LOC, 'obj');
    const val = literal(ZERO_LOC, 'key');
    const n = lookupVal(ZERO_LOC, { target, val });
    expect(n.type).toBe('lookupVal');
  });

  test('ifNode creates if node with named fields', () => {
    const cond = literal(ZERO_LOC, true);
    const body = output(ZERO_LOC, []);
    const n = ifNode(ZERO_LOC, { cond, body, else_: null });
    expect(n.type).toBe('if');
    expect(n.cond).toBe(cond);
    expect(n.else_).toBeNull();
  });

  test('root creates root node with children', () => {
    const n = root(ZERO_LOC, [output(ZERO_LOC, [])]);
    expect(n.type).toBe('root');
    expect(n.children.length).toBe(1);
  });
});

describe('type guards', () => {
  test('isSymbol narrows', () => {
    const n = symbol(ZERO_LOC, 'x');
    expect(isSymbol(n)).toBe(true);
    expect(isSymbol(literal(ZERO_LOC, 'y'))).toBe(false);
  });

  test('isBlock narrows', () => {
    const n = block(ZERO_LOC, { name: 'x', body: output(ZERO_LOC, []) });
    expect(isBlock(n)).toBe(true);
    expect(isBlock(literal(ZERO_LOC, 1))).toBe(false);
  });

  test('isFunCall narrows', () => {
    const n = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'f'), args: [] });
    expect(isFunCall(n)).toBe(true);
  });

  test('isLookupVal narrows', () => {
    const n = lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'x'), val: literal(ZERO_LOC, 'y') });
    expect(isLookupVal(n)).toBe(true);
  });
});

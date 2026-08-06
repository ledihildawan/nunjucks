import { describe, test, expect } from 'bun:test';
import {
  root, output, literal, symbol, templateData,
  add, if_, funCall, lookupVal, block,
  isBlock, isFunCall, isLookupVal, isSymbol,
} from './index.ts';

describe('factory: node creation', () => {
  test('literal creates value node', () => {
    const n = literal(0, 0, 'hello');
    expect(n.type).toBe('literal');
    expect(n.value).toBe('hello');
    expect(n.lineno).toBe(0);
  });

  test('symbol creates symbol node', () => {
    const n = symbol(0, 0, 'x');
    expect(n.type).toBe('symbol');
    expect(n.value).toBe('x');
  });

  test('add creates binary op node', () => {
    const left = literal(0, 0, 1);
    const right = literal(0, 0, 2);
    const n = add(0, 0, left, right);
    expect(n.type).toBe('add');
    expect(n.operator).toBe('+');
  });

  test('block creates block node with name and body', () => {
    const body = output(0, 0, [templateData(0, 0, 'hi')]);
    const n = block(0, 0, 'content', body);
    expect(n.type).toBe('block');
    expect(n.name).toBe('content');
  });

  test('funCall creates call node', () => {
    const name = symbol(0, 0, 'greet');
    const n = funCall(0, 0, name, []);
    expect(n.type).toBe('funCall');
    expect(n.args).toEqual([]);
  });

  test('lookupVal creates lookup node', () => {
    const target = symbol(0, 0, 'obj');
    const val = literal(0, 0, 'key');
    const n = lookupVal(0, 0, target, val);
    expect(n.type).toBe('lookupVal');
  });

  test('if_ creates if node with named fields', () => {
    const cond = literal(0, 0, true);
    const body = output(0, 0, []);
    const n = if_(0, 0, { cond, body, else_: null });
    expect(n.type).toBe('if');
    expect(n.cond).toBe(cond);
    expect(n.else_).toBeNull();
  });

  test('root creates root node with children', () => {
    const n = root(0, 0, [output(0, 0, [])]);
    expect(n.type).toBe('root');
    expect(n.children.length).toBe(1);
  });
});

describe('type guards', () => {
  test('isSymbol narrows', () => {
    const n = symbol(0, 0, 'x');
    expect(isSymbol(n)).toBe(true);
    expect(isSymbol(literal(0, 0, 'y'))).toBe(false);
  });

  test('isBlock narrows', () => {
    const n = block(0, 0, 'x', output(0, 0, []));
    expect(isBlock(n)).toBe(true);
    expect(isBlock(literal(0, 0, 1))).toBe(false);
  });

  test('isFunCall narrows', () => {
    const n = funCall(0, 0, symbol(0, 0, 'f'), []);
    expect(isFunCall(n)).toBe(true);
  });

  test('isLookupVal narrows', () => {
    const n = lookupVal(0, 0, symbol(0, 0, 'x'), literal(0, 0, 'y'));
    expect(isLookupVal(n)).toBe(true);
  });
});

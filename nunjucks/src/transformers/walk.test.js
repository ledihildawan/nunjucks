import { describe, test, expect } from 'bun:test';
import { mapCOW, walk, depthWalk } from './walk.js';
import {
  Node, NodeList, Root, Literal, AstSymbol, Group,
  ArrayNode, Pair, Dict, LookupVal, Slice,
  If, FunCall, KeywordArgs, Output, TemplateData,
  Add, Sub, Mul, Div, Mod, Not, Compare, CompareOperand,
  CallExtension, Block,
} from '../nodes/index.js';

describe('mapCOW', () => {
  test('returns original array when no changes', () => {
    const arr = [1, 2, 3];
    const result = mapCOW(arr, (x) => x);
    expect(result).toBe(arr);
  });

  test('returns new array when item changes', () => {
    const arr = [1, 2, 3];
    const result = mapCOW(arr, (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
    expect(result).not.toBe(arr);
  });

  test('keeps original unchanged on partial change', () => {
    const arr = [1, 2, 3];
    mapCOW(arr, (x) => x === 2 ? 99 : x);
    expect(arr).toEqual([1, 2, 3]);
  });

  test('returns new array with only changed items different', () => {
    const arr = [1, 2, 3];
    const result = mapCOW(arr, (x) => x === 2 ? 99 : x);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(99);
    expect(result[2]).toBe(3);
  });
});

describe('walk', () => {
  test('returns non-Node input unchanged', () => {
    expect(walk(null, () => {})).toBe(null);
    expect(walk('string', () => {})).toBe('string');
    expect(walk(42, () => {})).toBe(42);
  });

  test('applies func to Literal node', () => {
    const lit = Literal(1, 0, 42);
    const spy = [];
    const result = walk(lit, (node) => { spy.push(node.typename); });
    expect(spy).toContain('Literal');
    expect(result).toBe(lit);
  });

  test('replaces node when func returns a new node', () => {
    const lit = Literal(1, 0, 42);
    const replacement = Literal(1, 0, 99);
    const result = walk(lit, () => replacement);
    expect(result).toBe(replacement);
  });

  test('walks children of NodeList', () => {
    const inner = Literal(2, 0, 1);
    const list = NodeList(1, 0, [inner]);
    const visited = [];
    walk(list, (node) => { visited.push(node.typename); });
    expect(visited).toContain('NodeList');
    expect(visited).toContain('Literal');
  });

  test('reconstructs NodeList when children change', () => {
    const inner = Literal(2, 0, 1);
    const list = NodeList(1, 0, [inner]);
    const result = walk(list, (node) => {
      if (node.typename === 'Literal') {
        return Literal(node.lineno, node.colno, 99);
      }
    });
    expect(result.typename).toBe('NodeList');
    expect(result.children[0].value).toBe(99);
  });

  test('walks Output with TemplateData', () => {
    const data = TemplateData(1, 0, 'hello');
    const out = Output(1, 0, [data]);
    const visited = [];
    walk(out, (node) => { visited.push(node.typename); });
    expect(visited).toContain('Output');
    expect(visited).toContain('TemplateData');
  });

  test('walks FunCall with args', () => {
    const lit = Literal(2, 0, 1);
    const args = KeywordArgs(2, 0, [lit]);
    const call = FunCall(1, 0, AstSymbol(1, 0, 'foo'), args);
    const visited = [];
    walk(call, (node) => { visited.push(node.typename); });
    expect(visited).toContain('FunCall');
    expect(visited).toContain('Literal');
  });

  test('walks arithmetic nodes', () => {
    const left = Literal(1, 0, 1);
    const right = Literal(1, 0, 2);
    const add = Add(1, 0, left, right);
    const visited = [];
    walk(add, (node) => { visited.push(node.typename); });
    expect(visited).toContain('Add');
    expect(visited).toContain('Literal');
  });

  test('walks Compare node', () => {
    const left = Literal(1, 0, 5);
    const compare = Compare(1, 0, left, []);
    const visited = [];
    walk(compare, (node) => { visited.push(node.typename); });
    expect(visited).toContain('Compare');
    expect(visited).toContain('Literal');
  });

  test('throws for unknown typename', () => {
    class FakeNode extends Node {
      get typename() { return 'UnknownType'; }
      get fields() { return []; }
    }
    const fakeNode = new FakeNode(1, 1);
    expect(() => walk(fakeNode, () => {})).toThrow('unknown typename');
  });

  test('walks CallExtension', () => {
    const ext = CallExtension(1, 0, 'myExt', 'method', [], []);
    const visited = [];
    walk(ext, (node) => { visited.push(node.typename); });
    expect(visited).toContain('CallExtension');
  });
});

describe('depthWalk', () => {
  test('walks depth-first (func called post-children)', () => {
    const inner = Literal(2, 0, 1);
    const outer = Literal(1, 0, 2);
    const list = NodeList(1, 0, [inner, outer]);
    const order = [];
    depthWalk(list, (node) => { order.push(node.typename); });
    expect(order.indexOf('Literal')).toBeLessThan(order.lastIndexOf('NodeList'));
  });

  test('replaces node from func in depth-first walk', () => {
    const lit = Literal(1, 0, 42);
    const replacement = Literal(1, 0, 99);
    const result = depthWalk(lit, () => replacement);
    expect(result).toBe(replacement);
  });
});

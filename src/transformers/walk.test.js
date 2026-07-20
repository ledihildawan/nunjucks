import { describe, test, expect } from 'bun:test';
import { mapCOW, walk, depthWalk } from './walk.js';
import { nodes } from '../nodes/index.js';

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
    const lit = nodes.literal(1, 0, 42);
    const spy = [];
    const result = walk(lit, (node) => { spy.push(nodes.getNodeTypeName(node)); });
    expect(spy).toContain('literal');
    expect(result).toBe(lit);
  });

  test('replaces node when func returns a new node', () => {
    const lit = nodes.literal(1, 0, 42);
    const replacement = nodes.literal(1, 0, 99);
    const result = walk(lit, () => replacement);
    expect(result).toBe(replacement);
  });

  test('walks children of NodeList', () => {
    const inner = nodes.literal(2, 0, 1);
    const list = nodes.nodeList(1, 0, [inner]);
    const visited = [];
    walk(list, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('nodeList');
    expect(visited).toContain('literal');
  });

  test('reconstructs NodeList when children change', () => {
    const inner = nodes.literal(2, 0, 1);
    const list = nodes.nodeList(1, 0, [inner]);
    const result = walk(list, (node) => {
      if (nodes.isLiteral(node)) {
        return nodes.literal(node.lineno, node.colno, 99);
      }
      return undefined;
    });
    expect(nodes.getNodeTypeName(result)).toBe('nodeList');
    expect(result.children[0].value).toBe(99);
  });

  test('walks Output with TemplateData', () => {
    const data = nodes.templateData(1, 0, 'hello');
    const out = nodes.output(1, 0, [data]);
    const visited = [];
    walk(out, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('output');
    expect(visited).toContain('templateData');
  });

  test('walks FunCall with args', () => {
    const lit = nodes.literal(2, 0, 1);
    const args = nodes.keywordArgs(2, 0, [lit]);
    const call = nodes.funCall(1, 0, nodes.symbol(1, 0, 'foo'), args);
    const visited = [];
    walk(call, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('funCall');
    expect(visited).toContain('literal');
  });

  test('walks arithmetic nodes', () => {
    const left = nodes.literal(1, 0, 1);
    const right = nodes.literal(1, 0, 2);
    const add = nodes.add(1, 0, left, right);
    const visited = [];
    walk(add, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('add');
    expect(visited).toContain('literal');
  });

  test('walks Compare node', () => {
    const left = nodes.literal(1, 0, 5);
    const compare = nodes.compare(1, 0, left, []);
    const visited = [];
    walk(compare, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('compare');
    expect(visited).toContain('literal');
  });

  test('walks CallExtension', () => {
    const ext = nodes.callExtension({ __name: 'myExt' }, 'method', [], []);
    const visited = [];
    walk(ext, (node) => { visited.push(nodes.getNodeTypeName(node)); });
    expect(visited).toContain('callExtension');
  });
});

describe('depthWalk', () => {
  test('walks depth-first (func called post-children)', () => {
    const inner = nodes.literal(2, 0, 1);
    const outer = nodes.literal(1, 0, 2);
    const list = nodes.nodeList(1, 0, [inner, outer]);
    const order = [];
    depthWalk(list, (node) => { order.push(nodes.getNodeTypeName(node)); });
    expect(order.indexOf('literal')).toBeLessThan(order.lastIndexOf('nodeList'));
  });

  test('replaces node from func in depth-first walk', () => {
    const lit = nodes.literal(1, 0, 42);
    const replacement = nodes.literal(1, 0, 99);
    const result = depthWalk(lit, () => replacement);
    expect(result).toBe(replacement);
  });
});

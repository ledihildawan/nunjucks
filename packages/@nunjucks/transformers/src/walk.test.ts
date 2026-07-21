import { describe, test, expect } from 'bun:test';
import { mapCOW, walk, depthWalk } from './walk.ts';
import { literal, nodeList, templateData, output, funCall, symbol, keywordArgs, add, compare, callExtension } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';
import { isLiteral } from '@nunjucks/nodes/guards';

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
    mapCOW(arr, (x) => (x === 2 ? 99 : x));
    expect(arr).toEqual([1, 2, 3]);
  });

  test('returns new array with only changed items different', () => {
    const arr = [1, 2, 3];
    const result = mapCOW(arr, (x) => (x === 2 ? 99 : x));
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(99);
    expect(result[2]).toBe(3);
  });
});

describe('walk', () => {
  test('returns non-Node input unchanged', () => {
    expect(walk(null as never, () => {})).toBe(null);
    expect(walk('string' as never, () => {})).toBe('string');
    expect(walk(42 as never, () => {})).toBe(42);
  });

  test('applies func to Literal node', () => {
    const lit = literal(1, 0, 42);
    const spy: string[] = [];
    const result = walk(lit, (node) => {
      spy.push(getNodeTypeName(node) as string);
    });
    expect(spy).toContain('literal');
    expect(result).toBe(lit);
  });

  test('replaces node when func returns a new node', () => {
    const lit = literal(1, 0, 42);
    const replacement = literal(1, 0, 99);
    const result = walk(lit, () => replacement);
    expect(result).toBe(replacement);
  });

  test('walks children of NodeList', () => {
    const inner = literal(2, 0, 1);
    const list = nodeList(1, 0, [inner]);
    const visited: string[] = [];
    walk(list, (node) => {
      visited.push(getNodeTypeName(node) as string);
    });
    expect(visited).toContain('nodeList');
    expect(visited).toContain('literal');
  });

  test('reconstructs NodeList when children change', () => {
    const inner = literal(2, 0, 1);
    const list = nodeList(1, 0, [inner]);
    const result = walk(list, (node) => {
      if (isLiteral(node)) {
        return literal(node.lineno, node.colno, 99);
      }
      return undefined;
    });
    expect(getNodeTypeName(result)).toBe('nodeList');
    expect((result as unknown as { children: { value: number }[] }).children[0].value).toBe(99);
  });

  test('walks Output with TemplateData', () => {
    const data = templateData(1, 0, 'hello');
    const out = output(1, 0, [data]);
    const visited: string[] = [];
    walk(out, (node) => {
      visited.push(getNodeTypeName(node) as string);
    });
    expect(visited).toContain('output');
    expect(visited).toContain('templateData');
  });

  test('walks FunCall with args', () => {
    const lit = literal(2, 0, 1);
    const args = keywordArgs(2, 0, [lit]);
    const call = funCall(1, 0, symbol(1, 0, 'foo'), args);
    const visited: string[] = [];
    walk(call, (node) => {
      visited.push(getNodeTypeName(node) as string);
    });
    expect(visited).toContain('funCall');
    expect(visited).toContain('literal');
  });

  test('walks arithmetic nodes', () => {
    const left = literal(1, 0, 1);
    const right = literal(1, 0, 2);
    const node = add(1, 0, left, right);
    const visited: string[] = [];
    walk(node, (n) => {
      visited.push(getNodeTypeName(n) as string);
    });
    expect(visited).toContain('add');
    expect(visited).toContain('literal');
  });

  test('walks Compare node', () => {
    const left = literal(1, 0, 5);
    const node = compare(1, 0, left, []);
    const visited: string[] = [];
    walk(node, (n) => {
      visited.push(getNodeTypeName(n) as string);
    });
    expect(visited).toContain('compare');
    expect(visited).toContain('literal');
  });

  test('walks CallExtension', () => {
    const ext = callExtension({ __name: 'myExt' }, 'method', [], []);
    const visited: string[] = [];
    walk(ext, (node) => {
      visited.push(getNodeTypeName(node) as string);
    });
    expect(visited).toContain('callExtension');
  });
});

describe('depthWalk', () => {
  test('walks depth-first (func called post-children)', () => {
    const inner = literal(2, 0, 1);
    const outer = literal(1, 0, 2);
    const list = nodeList(1, 0, [inner, outer]);
    const order: string[] = [];
    depthWalk(list, (node) => {
      order.push(getNodeTypeName(node) as string);
    });
    expect(order.indexOf('literal')).toBeLessThan(order.lastIndexOf('nodeList'));
  });

  test('replaces node from func in depth-first walk', () => {
    const lit = literal(1, 0, 42);
    const replacement = literal(1, 0, 99);
    const result = depthWalk(lit, () => replacement);
    expect(result).toBe(replacement);
  });
});

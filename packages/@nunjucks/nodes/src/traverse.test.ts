import { describe, test, expect } from 'bun:test';
import { root, output, templateData, block } from './index.ts';
import type { Node, ChildrenNode } from './index.ts';
import { walk, findAll, appendChild } from './traverse.ts';

describe('walk', () => {
  test('visits all nodes in AST', () => {
    const ast = root(0, 0, [
      output(0, 0, [templateData(0, 0, 'a')]),
      output(0, 0, [templateData(0, 0, 'b')]),
    ]) as Node;
    const visited: string[] = [];
    walk(ast, (n: Node) => {
      visited.push(n.type);
      return undefined;
    });
    expect(visited).toContain('root');
    expect(visited).toContain('output');
    expect(visited).toContain('templateData');
  });

  test('replaces node when fn returns new node', () => {
    const ast = root(0, 0, [
      output(0, 0, [templateData(0, 0, 'a')]),
    ]) as Node;
    const transformed = walk(ast, (n: Node) => {
      if (n.type === 'templateData') {
        return { ...n, value: 'REPLACED' } as Node;
      }
      return undefined;
    }) as Node & { children: Node[] };
    expect(transformed).not.toBe(ast);
  });

  test('returns same reference when no changes', () => {
    const ast = root(0, 0, [output(0, 0, [])]) as Node;
    const result = walk(ast, () => undefined);
    expect(result).toBe(ast);
  });
});

describe('findAll', () => {
  test('finds nodes by type string', () => {
    const ast = root(0, 0, [
      output(0, 0, [templateData(0, 0, 'a')]),
      output(0, 0, [templateData(0, 0, 'b')]),
    ]) as Node;
    const results = findAll(ast, 'output');
    expect(results.length).toBe(2);
  });

  test('finds nodes by predicate', () => {
    const ast = root(0, 0, [
      block(0, 0, 'x', output(0, 0, [])),
      block(0, 0, 'y', output(0, 0, [])),
    ]) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'block');
    expect(results.length).toBe(2);
  });

  test('returns empty for non-existent type', () => {
    const ast = root(0, 0, []) as Node;
    const results = findAll(ast, 'nonexistent');
    expect(results).toEqual([]);
  });
});

describe('appendChild', () => {
  test('appends child to node with children array', () => {
    const node = output(0, 0, []) as ChildrenNode;
    const child = templateData(0, 0, 'x');
    const result = appendChild(node, child);
    expect(result.children.length).toBe(1);
    expect(result.children[0]).toBe(child);
  });

  test('does not mutate original node', () => {
    const node = output(0, 0, []) as ChildrenNode;
    const originalLen = node.children.length;
    appendChild(node, templateData(0, 0, 'x'));
    expect(node.children.length).toBe(originalLen);
  });
});

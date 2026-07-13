import { describe, test, expect } from 'bun:test';
import { liftSuper } from './super-transforms.js';
import { nodes } from '../nodes/index.js';

describe('liftSuper', () => {
  test('returns ast unchanged when no Block nodes', () => {
    const root = nodes.root(1, 0, [nodes.literal(1, 0, 42)]);
    const result = liftSuper(root);
    expect(result).toBe(root);
  });

  test('replaces FunCall(name=super) with Symbol in block body', () => {
    const body = nodes.nodeList(1, 0, [
      nodes.funCall(1, 0, nodes.symbol(1, 0, 'super'), []),
    ]);
    const block = nodes.block(1, 0, 'content', body);
    const root = nodes.root(1, 0, [block]);
    const result = liftSuper(root);
    const resultBlock = result.children[0];
    const secondChild = resultBlock.body.children[1];
    expect(nodes.getNodeTypeName(secondChild)).toBe('symbol');
  });

  test('result has correct block name', () => {
    const body = nodes.nodeList(1, 0, [
      nodes.funCall(1, 0, nodes.symbol(1, 0, 'super'), []),
    ]);
    const block = nodes.block(1, 0, 'content', body);
    const root = nodes.root(1, 0, [block]);
    const result = liftSuper(root);
    expect(result.children[0].name).toBe('content');
  });

  test('prepends Super node to body when super() is used', () => {
    const body = nodes.nodeList(1, 0, [
      nodes.funCall(1, 0, nodes.symbol(1, 0, 'super'), []),
    ]);
    const block = nodes.block(1, 0, 'content', body);
    const root = nodes.root(1, 0, [block]);
    const result = liftSuper(root);
    const resultBlock = result.children[0];
    expect(nodes.isSuper(resultBlock.body.children[0])).toBe(true);
    expect(resultBlock.body.children.length).toBe(2);
  });

  test('does not modify block without super call', () => {
    const body = nodes.nodeList(1, 0, [nodes.literal(1, 0, 'no super')]);
    const block = nodes.block(1, 0, 'content', body);
    const root = nodes.root(1, 0, [block]);
    const result = liftSuper(root);
    expect(result.children[0].body.children.length).toBe(1);
    expect(nodes.isLiteral(result.children[0].body.children[0])).toBe(true);
  });
});

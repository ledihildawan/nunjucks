import { describe, test, expect } from 'bun:test';
import { liftSuper } from './super.ts';
import { root, literal, funCall, symbol, nodeList, block } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';
import { isSuper, isLiteral } from '@nunjucks/nodes/guards';

describe('liftSuper', () => {
  test('returns ast unchanged when no Block nodes', () => {
    const ast = root(1, 0, [literal(1, 0, 42)]);
    const result = liftSuper(ast);
    expect(result).toBe(ast);
  });

  test('replaces FunCall(name=super) with Symbol in block body', () => {
    const body = nodeList(1, 0, [funCall(1, 0, symbol(1, 0, 'super'), [])]);
    const blk = block(1, 0, 'content', body);
    const ast = root(1, 0, [blk]);
    const result = liftSuper(ast);
    const resultBlock = (result as unknown as { children: unknown[] }).children[0];
    const resultBody = (resultBlock as unknown as { body: { children: unknown[] } }).body;
    const secondChild = resultBody.children[1];
    expect(getNodeTypeName(secondChild)).toBe('symbol');
  });

  test('result has correct block name', () => {
    const body = nodeList(1, 0, [funCall(1, 0, symbol(1, 0, 'super'), [])]);
    const blk = block(1, 0, 'content', body);
    const ast = root(1, 0, [blk]);
    const result = liftSuper(ast);
    const resultBlock = (result as unknown as { children: { name: string }[] }).children[0]!;
    expect(resultBlock.name).toBe('content');
  });

  test('prepends Super node to body when super() is used', () => {
    const body = nodeList(1, 0, [funCall(1, 7, symbol(1, 7, 'super'), [])]);
    const blk = block(1, 0, 'content', body);
    const ast = root(1, 0, [blk]);
    const result = liftSuper(ast);
    const resultBlock = (result as unknown as { children: unknown[] }).children[0];
    const resultBody = (resultBlock as unknown as { body: { children: unknown[]; } }).body;
    const firstChild = resultBody.children[0] as { lineno: number; colno: number };
    expect(isSuper(firstChild)).toBe(true);
    expect(firstChild.lineno).toBe(1);
    expect(firstChild.colno).toBe(7);
    expect(resultBody.children.length).toBe(2);
  });

  test('does not modify block without super call', () => {
    const body = nodeList(1, 0, [literal(1, 0, 'no super')]);
    const blk = block(1, 0, 'content', body);
    const ast = root(1, 0, [blk]);
    const result = liftSuper(ast);
    const resultBlock = (result as unknown as { children: unknown[] }).children[0];
    const resultBody = (resultBlock as unknown as { body: { children: unknown[] } }).body;
    expect(resultBody.children.length).toBe(1);
    expect(isLiteral(resultBody.children[0])).toBe(true);
  });
});

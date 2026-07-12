import { describe, test, expect } from 'bun:test';
import { liftSuper } from './super-transforms.js';
import {
  NodeList, Root, Block, FunCall, AstSymbol, Super, Literal,
  getNodeTypeName,
} from '../nodes/index.js';

describe('liftSuper', () => {
  test('returns ast unchanged when no Block nodes', () => {
    const root = Root(1, 0, [Literal(1, 0, 42)]);
    const result = liftSuper(root);
    expect(result).toBe(root);
  });

  test('replaces FunCall(name=super) with AstSymbol in block body', () => {
    const body = NodeList(1, 0, [
      FunCall(1, 0, AstSymbol(1, 0, 'super'), []),
    ]);
    const block = Block(1, 0, 'content', body);
    const root = Root(1, 0, [block]);
    const result = liftSuper(root);
    const resultBlock = result.children[0];
    const secondChild = resultBlock.body.children[1];
    expect(getNodeTypeName(secondChild)).toBe('Symbol');
  });

  test('result has correct block name', () => {
    const body = NodeList(1, 0, [
      FunCall(1, 0, AstSymbol(1, 0, 'super'), []),
    ]);
    const block = Block(1, 0, 'content', body);
    const root = Root(1, 0, [block]);
    const result = liftSuper(root);
    expect(result.children[0].name).toBe('content');
  });

  test('prepends Super node to body when super() is used', () => {
    const body = NodeList(1, 0, [
      FunCall(1, 0, AstSymbol(1, 0, 'super'), []),
    ]);
    const block = Block(1, 0, 'content', body);
    const root = Root(1, 0, [block]);
    const result = liftSuper(root);
    const resultBlock = result.children[0];
    expect(resultBlock.body.children[0]).toBeInstanceOf(Super);
    expect(resultBlock.body.children.length).toBe(2);
  });

  test('does not modify block without super call', () => {
    const body = NodeList(1, 0, [Literal(1, 0, 'no super')]);
    const block = Block(1, 0, 'content', body);
    const root = Root(1, 0, [block]);
    const result = liftSuper(root);
    expect(result.children[0].body.children.length).toBe(1);
    expect(result.children[0].body.children[0]).toBeInstanceOf(Literal);
  });
});

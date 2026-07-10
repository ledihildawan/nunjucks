import { describe, test, expect } from 'bun:test';
import { convertStatements } from './statement-transforms.js';
import {
  NodeList, Root, If, For, IfAsync, AsyncEach, AsyncAll, Pipe, PipeAsync,
  AstSymbol, Literal,
} from '../nodes/index.js';

describe('convertStatements', () => {
  test('returns ast unchanged when no If or For nodes', () => {
    const root = new Root(1, 0, [new Literal(1, 0, 'hi')]);
    const result = convertStatements(root);
    expect(result).toBe(root);
  });

  test('converts If with PipeAsync child to IfAsync', () => {
    const cond = new PipeAsync(1, 0, new AstSymbol(1, 0, 'filter'), [], new AstSymbol(1, 0, 's'));
    const ifNode = new If(1, 0, cond, new NodeList(1, 0, []));
    const root = new Root(1, 0, [ifNode]);
    const result = convertStatements(root);
    expect(result.children[0]).toBeInstanceOf(IfAsync);
  });

  test('keeps If without async children as If', () => {
    const ifNode = new If(1, 0, new Literal(1, 0, true), new NodeList(1, 0, []));
    const root = new Root(1, 0, [ifNode]);
    const result = convertStatements(root);
    expect(result.children[0]).toBeInstanceOf(If);
    expect(result.children[0]).not.toBeInstanceOf(IfAsync);
  });

  test('converts For with async child to AsyncEach', () => {
    const arr = new PipeAsync(1, 0, new AstSymbol(1, 0, 'filter'), [], new AstSymbol(1, 0, 's'));
    const forNode = new For(1, 0, arr, new AstSymbol(1, 0, 'x'), new NodeList(1, 0, []));
    const root = new Root(1, 0, [forNode]);
    const result = convertStatements(root);
    expect(result.children[0]).toBeInstanceOf(AsyncEach);
  });

  test('keeps For without async children as For', () => {
    const forNode = new For(1, 0, new Literal(1, 0, [1, 2]), new AstSymbol(1, 0, 'x'), new NodeList(1, 0, []));
    const root = new Root(1, 0, [forNode]);
    const result = convertStatements(root);
    expect(result.children[0]).toBeInstanceOf(For);
    expect(result.children[0]).not.toBeInstanceOf(AsyncEach);
  });
});

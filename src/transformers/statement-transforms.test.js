import { describe, test, expect } from 'bun:test';
import { convertStatements } from './statement-transforms.js';
import {
  NodeList, Root, If, For, IfAsync, AsyncEach, AsyncAll, Pipe, PipeAsync,
  AstSymbol, Literal,
} from '../nodes/index.js';

describe('convertStatements', () => {
  test('returns ast unchanged when no If or For nodes', () => {
    const root = Root(1, 0, [Literal(1, 0, 'hi')]);
    const result = convertStatements(root);
    expect(result).toBe(root);
  });

  test('converts If with PipeAsync child to IfAsync', () => {
    const cond = PipeAsync(1, 0, AstSymbol(1, 0, 'filter'), [], AstSymbol(1, 0, 's'));
    const ifNode = If(1, 0, cond, NodeList(1, 0, []));
    const root = Root(1, 0, [ifNode]);
    const result = convertStatements(root);
    expect(result.children[0].typename).toBe('IfAsync');
  });

  test('keeps If without async children as If', () => {
    const ifNode = If(1, 0, Literal(1, 0, true), NodeList(1, 0, []));
    const root = Root(1, 0, [ifNode]);
    const result = convertStatements(root);
    expect(result.children[0].typename).toBe('If');
    expect(result.children[0].typename).not.toBe('IfAsync');
  });

  test('converts For with async child to AsyncEach', () => {
    const arr = PipeAsync(1, 0, AstSymbol(1, 0, 'filter'), [], AstSymbol(1, 0, 's'));
    const forNode = For(1, 0, arr, AstSymbol(1, 0, 'x'), NodeList(1, 0, []));
    const root = Root(1, 0, [forNode]);
    const result = convertStatements(root);
    expect(result.children[0].typename).toBe('AsyncEach');
  });

  test('keeps For without async children as For', () => {
    const forNode = For(1, 0, Literal(1, 0, [1, 2]), AstSymbol(1, 0, 'x'), NodeList(1, 0, []));
    const root = Root(1, 0, [forNode]);
    const result = convertStatements(root);
    expect(result.children[0].typename).toBe('For');
    expect(result.children[0].typename).not.toBe('AsyncEach');
  });
});

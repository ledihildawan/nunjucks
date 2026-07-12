import { describe, test, expect } from 'bun:test';
import { cps, transform } from './index.js';
import { getNodeTypeName, Root } from '../nodes/index.js';

describe('cps', () => {
  test('returns processed AST', () => {
    const ast = Root(0, 0, []);
    const result = cps(ast, []);
    expect(result).toBeDefined();
    expect(getNodeTypeName(result)).toBe('Root');
  });
});

describe('transform', () => {
  test('returns processed AST with asyncPipes', () => {
    const ast = Root(0, 0, []);
    const result = transform(ast, ['upper']);
    expect(result).toBeDefined();
  });

  test('defaults asyncPipes to empty array', () => {
    const ast = Root(0, 0, []);
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

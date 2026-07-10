import { describe, test, expect } from 'bun:test';
import { cps, transform } from './index.js';

describe('cps', () => {
  test('returns processed AST', () => {
    const ast = { typename: 'Root', children: [] };
    const result = cps(ast, []);
    expect(result).toBeDefined();
    expect(result.typename).toBe('Root');
  });
});

describe('transform', () => {
  test('returns processed AST with asyncPipes', () => {
    const ast = { typename: 'Root', children: [] };
    const result = transform(ast, ['upper']);
    expect(result).toBeDefined();
  });

  test('defaults asyncPipes to empty array', () => {
    const ast = { typename: 'Root', children: [] };
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

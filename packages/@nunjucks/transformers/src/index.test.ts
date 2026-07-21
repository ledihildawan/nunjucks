import { describe, test, expect } from 'bun:test';
import { cps, transform } from './index.ts';
import { root } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('cps', () => {
  test('returns processed AST', () => {
    const ast = root(0, 0, []);
    const result = cps(ast, []);
    expect(result).toBeDefined();
    expect(getNodeTypeName(result)).toBe('root');
  });
});

describe('transform', () => {
  test('returns processed AST with asyncPipes', () => {
    const ast = root(0, 0, []);
    const result = transform(ast, ['upper']);
    expect(result).toBeDefined();
  });

  test('defaults asyncPipes to empty array', () => {
    const ast = root(0, 0, []);
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

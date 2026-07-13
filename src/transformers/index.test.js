import { describe, test, expect } from 'bun:test';
import { cps, transform } from './index.js';
import { nodes } from '../nodes/index.js';

describe('cps', () => {
  test('returns processed AST', () => {
    const ast = nodes.root(0, 0, []);
    const result = cps(ast, []);
    expect(result).toBeDefined();
    expect(nodes.getNodeTypeName(result)).toBe('root');
  });
});

describe('transform', () => {
  test('returns processed AST with asyncPipes', () => {
    const ast = nodes.root(0, 0, []);
    const result = transform(ast, ['upper']);
    expect(result).toBeDefined();
  });

  test('defaults asyncPipes to empty array', () => {
    const ast = nodes.root(0, 0, []);
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

import { describe, test, expect } from 'bun:test';
import { transform } from './index.ts';
import { root } from '@nunjucks/nodes';

describe('transform', () => {
  test('returns processed AST', () => {
    const ast = root(0, 0, []);
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

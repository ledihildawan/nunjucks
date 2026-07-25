import { describe, test, expect } from 'bun:test';
import { transform } from './index.ts';
import { root } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('transform', () => {
  test('returns processed AST', () => {
    const ast = root(0, 0, []);
    const result = transform(ast);
    expect(result).toBeDefined();
  });
});

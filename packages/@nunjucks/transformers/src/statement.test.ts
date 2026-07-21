import { describe, test, expect } from 'bun:test';
import { convertStatements } from './statement.ts';
import { root, literal } from '@nunjucks/nodes';

describe('convertStatements', () => {
  test('returns ast unchanged', () => {
    const ast = root(1, 0, [literal(1, 0, 'hi')]);
    const result = convertStatements(ast);
    expect(result).toBe(ast);
  });
});

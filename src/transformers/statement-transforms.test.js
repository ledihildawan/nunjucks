import { describe, test, expect } from 'bun:test';
import { convertStatements } from './statement-transforms.js';
import { nodes } from '../nodes/index.js';

describe('convertStatements', () => {
  test('returns ast unchanged', () => {
    const root = nodes.root(1, 0, [nodes.literal(1, 0, 'hi')]);
    const result = convertStatements(root);
    expect(result).toBe(root);
  });
});

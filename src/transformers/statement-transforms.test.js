import { describe, test, expect } from 'bun:test';
import { convertStatements } from './statement-transforms.js';
import {
  Root, Literal,
} from '../nodes/index.js';

describe('convertStatements', () => {
  test('returns ast unchanged', () => {
    const root = Root(1, 0, [Literal(1, 0, 'hi')]);
    const result = convertStatements(root);
    expect(result).toBe(root);
  });
});

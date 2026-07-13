import { describe, test, expect } from 'bun:test';
import { parseExtends } from './extends.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseExtends', () => {
  test('parses extends statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'extends', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'layout', lineno: 1, colno: 9 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 16 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const templateNode = { lineno: 1, colno: 9 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return templateNode;
      },
    });

    const result = parseExtends(ctx);

    expect(nodes.isExtends(result)).toBe(true);
    expect(result.template).toBe(templateNode);
  });

  test('fails if not extends keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseExtends(ctx)).toThrow('expected extends');
  });
});

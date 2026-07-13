import { describe, test, expect } from 'bun:test';
import { parseBlock } from './block.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseBlock', () => {
  test('parses block statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'content', lineno: 1, colno: 7 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 20 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const nameNode = nodes.symbol(1, 7, 'content');
    const body = { lineno: 2, colno: 1 };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: (noPostfix) => {
        nextToken(ctx);
        return nameNode;
      },
      parseUntilBlocks: () => body,
    });

    const result = parseBlock(ctx);

    expect(nodes.isBlock(result)).toBe(true);
    expect(result.name).toBe(nameNode);
    expect(result.name.value).toBe('content');
    expect(result.body).toBe(body);
  });

  test('fails if not block keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseBlock(ctx)).toThrow('expected block');
  });

  test('fails if block name is not a symbol', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 },
      { type: 'int', value: '42', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        return { lineno: 1, colno: 7, typename: 'Literal', value: 42 };
      },
    });

    expect(() => parseBlock(ctx)).toThrow('variable name expected');
  });
});

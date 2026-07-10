import { describe, test, expect } from 'bun:test';
import { parseMacro } from './macro.js';
import { Macro, AstSymbol, NodeList } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseMacro', () => {
  test('parses macro statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'macro', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'myMacro', lineno: 1, colno: 7 },
      { type: 'left-paren', value: '(', lineno: 1, colno: 15 },
      { type: 'right-paren', value: ')', lineno: 1, colno: 16 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 18 },
      { type: TOKEN_SYMBOL, value: 'content', lineno: 2, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 2, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'endmacro', lineno: 2, colno: 10 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 2, colno: 19 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const nameNode = new AstSymbol(1, 7, 'myMacro');
    const args = NodeList(1, 15, []);
    const body = NodeList(2, 1, []);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: (noPostfix) => {
        nextToken(ctx);
        return nameNode;
      },
      parseSignature: () => {
        nextToken(ctx);
        nextToken(ctx);
        return args;
      },
      parseUntilBlocks: () => body,
    });

    const result = parseMacro(ctx);

    expect(result).toBeInstanceOf(Macro);
    expect(result.name).toBe(nameNode);
    expect(result.args).toBe(args);
    expect(result.body).toBe(body);
  });

  test('fails if not macro keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseMacro(ctx)).toThrow('expected macro');
  });
});

import { describe, test, expect } from 'bun:test';
import { parseFilterStatement } from './filter.js';
import { Output, Filter, AstSymbol } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseFilterStatement', () => {
  test('parses filter statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'filter', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'escape', lineno: 1, colno: 8 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'endfilter', lineno: 2, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 2, colno: 11 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const nameNode = new AstSymbol(1, 8, 'escape');
    const captureBody = { lineno: 2, colno: 1 };
    const ctx = Object.assign(createCursor(tokens), {
      parseFilterName: () => {
        nextToken(ctx);
        return nameNode;
      },
      parseFilterArgs: () => [],
      parseUntilBlocks: () => captureBody,
    });

    const result = parseFilterStatement(ctx);

    expect(result).toBeInstanceOf(Output);
    const filterNode = result.children[0];
    expect(filterNode).toBeInstanceOf(Filter);
    expect(filterNode.name).toBe(nameNode);
  });

  test('fails if not filter keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseFilterStatement(ctx)).toThrow('expected filter');
  });
});

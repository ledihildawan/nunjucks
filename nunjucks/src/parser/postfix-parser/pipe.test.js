import { describe, test, expect } from 'bun:test';
import { parsePipe, parseFilterName, parseFilterArgs } from './pipe.js';
import { AstSymbol, Pipe, NodeList, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_OPERATOR, TOKEN_PIPEFORWARD, TOKEN_LEFT_PAREN } from '../../lexer/token-types.js';

describe('parseFilterName', () => {
  test('parses a single symbol as filter name', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'escape', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    const result = parseFilterName(ctx);

    expect(result).toBeInstanceOf(AstSymbol);
    expect(result.value).toBe('escape');
  });

  test('parses dotted filter name', () => {
    let n = 0;
    const tokens = {
      nextToken: () => {
        const seq = [
          { type: TOKEN_SYMBOL, value: 'my', lineno: 1, colno: 1 },
          { type: TOKEN_OPERATOR, value: '.', lineno: 1, colno: 3 },
          { type: TOKEN_SYMBOL, value: 'filter', lineno: 1, colno: 5 },
        ];
        return seq[n++];
      }
    };
    const ctx = createCursor(tokens);

    const result = parseFilterName(ctx);

    expect(result).toBeInstanceOf(AstSymbol);
    expect(result.value).toBe('my.filter');
  });

  test('expects symbol token', () => {
    const tokens = { nextToken: () => ({ type: 'int', value: '42', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseFilterName(ctx)).toThrow('expected symbol');
  });
});

describe('parseFilterArgs', () => {
  test('returns empty array when next token is not left paren', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'foo', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    const result = parseFilterArgs(ctx, { lineno: 1, colno: 1 });

    expect(result).toEqual([]);
  });

  test('parses args when next token is left paren', () => {
    const argNodes = [new Literal(1, 3, 'x')];
    const tokens = {
      nextToken: () => ({ type: TOKEN_LEFT_PAREN, value: '(', lineno: 1, colno: 5 }),
    };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: () => ({
        args: { children: argNodes },
      }),
    });

    const result = parseFilterArgs(ctx, { lineno: 1, colno: 1 });

    expect(result).toBe(argNodes);
  });
});

describe('parsePipe', () => {
  test('returns node unchanged when no pipe token', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));
    const node = { lineno: 1, colno: 1 };

    const result = parsePipe(ctx, node);

    expect(result).toBe(node);
  });

  test('parses pipe with filter', () => {
    const seq = [
      { type: TOKEN_PIPEFORWARD, value: '|>', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'escape', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 11 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens));
    const node = new Literal(1, 1, 'hello');

    const result = parsePipe(ctx, node);

    expect(result).toBeInstanceOf(Pipe);
    expect(result.name.value).toBe('escape');
    expect(result.args.children[0]).toBe(node);
  });
});

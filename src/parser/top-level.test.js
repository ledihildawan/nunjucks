import { describe, test, expect } from 'bun:test';
import { parseUntilBlocks, parseNodes } from './top-level.js';
import { createCursor } from './cursor.js';
import { TOKEN_DATA, TOKEN_BLOCK_START, TOKEN_VARIABLE_START, TOKEN_VARIABLE_END, TOKEN_COMMENT } from '../lexer/token-types.js';
import { Output, TemplateData } from '../nodes/index.js';

describe('parseUntilBlocks', () => {
  test('sets breakOnBlocks and calls ctx.parse', () => {
    const parseResult = { type: 'nodes' };
    let savedBreak;
    const ctx = {
      breakOnBlocks: null,
      parse: () => {
        savedBreak = ctx.breakOnBlocks;
        return parseResult;
      },
    };

    const result = parseUntilBlocks(ctx, 'endblock', 'else');

    expect(savedBreak).toEqual(['endblock', 'else']);
    expect(ctx.breakOnBlocks).toBeNull();
    expect(result).toBe(parseResult);
  });

  test('restores previous breakOnBlocks', () => {
    const ctx = {
      breakOnBlocks: ['original'],
      parse: () => {
        return [];
      },
    };

    parseUntilBlocks(ctx, 'endblock');

    expect(ctx.breakOnBlocks).toEqual(['original']);
  });

  test('works with no block names', () => {
    const ctx = {
      breakOnBlocks: null,
      parse: () => [],
    };

    const result = parseUntilBlocks(ctx);

    expect(ctx.breakOnBlocks).toBeNull();
    expect(result).toEqual([]);
  });
});

describe('parseNodes', () => {
  test('parses TOKEN_DATA into Output with TemplateData', () => {
    const seq = [
      { type: TOKEN_DATA, value: 'hello', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', COMMENT_START: '{#' } }),
    });

    const result = parseNodes(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Output);
    expect(result[0].children[0]).toBeInstanceOf(TemplateData);
    expect(result[0].children[0].value).toBe('hello');
  });

  test('trims leading whitespace when dropLeadingWhitespace is true', () => {
    const seq = [
      { type: TOKEN_DATA, value: '   hello', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      dropLeadingWhitespace: true,
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', COMMENT_START: '{#' } }),
    });

    const result = parseNodes(ctx);

    expect(result[0].children[0].value).toBe('hello');
  });

  test('trims trailing whitespace before block-start with dash', () => {
    const seq = [
      { type: TOKEN_DATA, value: 'hello   ', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_START, value: '{%-', lineno: 1, colno: 9 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      dropLeadingWhitespace: false,
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', COMMENT_START: '{#' } }),
      parseStatement: () => null,
    });

    const result = parseNodes(ctx);

    expect(result[0].children[0].value).toBe('hello');
  });

  test('parses TOKEN_BLOCK_START via parseStatement', () => {
    const seq = [
      { type: TOKEN_BLOCK_START, value: '{%', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    let statementCalled = false;
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', COMMENT_START: '{#' } }),
      parseStatement: () => {
        statementCalled = true;
        return null;
      },
    });

    parseNodes(ctx);

    expect(statementCalled).toBe(true);
  });

  test('parses TOKEN_VARIABLE_START via parseExpression', () => {
    const seq = [
      { type: TOKEN_VARIABLE_START, value: '{{', lineno: 1, colno: 1 },
      { type: TOKEN_VARIABLE_END, value: '}}', lineno: 1, colno: 13 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const expr = { type: 'symbol', value: 'foo' };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', VARIABLE_END: '}}', COMMENT_START: '{#' } }),
      parseExpression: () => expr,
    });

    const result = parseNodes(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Output);
    expect(result[0].children[0]).toBe(expr);
  });

  test('parses TOKEN_COMMENT and sets dropLeadingWhitespace', () => {
    const seq = [
      { type: TOKEN_COMMENT, value: '{# comment -#}', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      dropLeadingWhitespace: false,
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', VARIABLE_END: '}}', COMMENT_START: '{#', COMMENT_END: '#}' } }),
    });

    const result = parseNodes(ctx);

    expect(result).toHaveLength(0);
    expect(ctx.dropLeadingWhitespace).toBe(true);
  });

  test('throws on unexpected token type', () => {
    const seq = [
      { type: 'UNKNOWN', value: '?', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(tokens, { tags: { VARIABLE_START: '{{', COMMENT_START: '{#' } }),
    });

    expect(() => parseNodes(ctx)).toThrow('Unexpected token at top-level');
  });
});

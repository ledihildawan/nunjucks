import { describe, test, expect } from 'bun:test';
import { parseImport } from './import.js';
import { Import, AstSymbol } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseImport', () => {
  test('parses import statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 8 },
      { type: TOKEN_SYMBOL, value: 'as', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'mac', lineno: 1, colno: 18 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 22 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const template = new AstSymbol(1, 8, 'macros');
    const target = new AstSymbol(1, 18, 'mac');
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? template : target;
        nextToken(ctx);
        return v;
      },
    });

    const result = parseImport(ctx);

    expect(result).toBeInstanceOf(Import);
    expect(result.template).toBe(template);
    expect(result.target).toBe(target);
    expect(result.withContext).toBeNull();
  });

  test('parses import with with context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 8 },
      { type: TOKEN_SYMBOL, value: 'as', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'mac', lineno: 1, colno: 18 },
      { type: TOKEN_SYMBOL, value: 'with', lineno: 1, colno: 22 },
      { type: TOKEN_SYMBOL, value: 'context', lineno: 1, colno: 27 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 35 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const template = new AstSymbol(1, 8, 'macros');
    const target = new AstSymbol(1, 18, 'mac');
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? template : target;
        nextToken(ctx);
        return v;
      },
    });

    const result = parseImport(ctx);

    expect(result).toBeInstanceOf(Import);
    expect(result.withContext).toBe(true);
  });

  test('fails if not import keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseImport(ctx)).toThrow('parseImport: expected import');
  });

  test('fails if missing as keyword', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 8 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 15 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return new AstSymbol(1, 8, 'macros'); },
    });

    expect(() => parseImport(ctx)).toThrow('parseImport: expected "as" keyword');
  });
});

import { describe, test, expect } from 'bun:test';
import { parseSwitch } from './switch.js';
import { Switch, Case, AstSymbol } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseSwitch', () => {
  test('parses switch with one case', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'switch', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 8 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'case', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: '1', lineno: 1, colno: 21 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
      { type: TOKEN_SYMBOL, value: 'endswitch', lineno: 1, colno: 29 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 39 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const expr = new AstSymbol(1, 8, 'x');
    const cond = new AstSymbol(1, 21, '1');
    const caseBody = { lineno: 1, colno: 26 };
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? expr : cond;
        nextToken(ctx);
        return v;
      },
      parseUntilBlocks: () => caseBody,
    });

    const result = parseSwitch(ctx);

    expect(result).toBeInstanceOf(Switch);
    expect(result.expr).toBe(expr);
    expect(result.cases.length).toBe(1);
    expect(result.cases[0]).toBeInstanceOf(Case);
    expect(result.cases[0].cond).toBe(cond);
    expect(result.cases[0].body).toBe(caseBody);
  });

  test('parses switch with multiple cases', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'switch', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 8 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'case', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: '1', lineno: 1, colno: 21 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
      { type: TOKEN_SYMBOL, value: 'case', lineno: 1, colno: 29 },
      { type: TOKEN_SYMBOL, value: '2', lineno: 1, colno: 34 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 36 },
      { type: TOKEN_SYMBOL, value: 'endswitch', lineno: 1, colno: 42 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 52 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const expr = new AstSymbol(1, 8, 'x');
    const cond1 = new AstSymbol(1, 21, '1');
    const cond2 = new AstSymbol(1, 34, '2');
    const body1 = { lineno: 1, colno: 26 };
    const body2 = { lineno: 1, colno: 39 };
    let exprCalls = 0;
    let blocksCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? expr : (exprCalls === 2 ? cond1 : cond2);
        nextToken(ctx);
        return v;
      },
      parseUntilBlocks: () => {
        blocksCalls++;
        return blocksCalls === 1 ? body1 : body2;
      },
    });

    const result = parseSwitch(ctx);

    expect(result).toBeInstanceOf(Switch);
    expect(result.cases.length).toBe(2);
  });

  test('parses switch with default case', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'switch', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 8 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'case', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: '1', lineno: 1, colno: 21 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
      { type: TOKEN_SYMBOL, value: 'default', lineno: 1, colno: 29 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 37 },
      { type: TOKEN_SYMBOL, value: 'endswitch', lineno: 1, colno: 43 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 53 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const expr = new AstSymbol(1, 8, 'x');
    const cond = new AstSymbol(1, 21, '1');
    const caseBody = { lineno: 1, colno: 26 };
    const defaultBody = { lineno: 1, colno: 40 };
    let exprCalls = 0;
    let blocksCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? expr : cond;
        nextToken(ctx);
        return v;
      },
      parseUntilBlocks: () => {
        blocksCalls++;
        return blocksCalls === 1 ? caseBody : defaultBody;
      },
    });

    const result = parseSwitch(ctx);

    expect(result).toBeInstanceOf(Switch);
    expect(result.cases.length).toBe(1);
    expect(result.default).toBe(defaultBody);
  });

  test('fails on unknown keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseSwitch(ctx)).toThrow('parseSwitch: expected');
  });
});

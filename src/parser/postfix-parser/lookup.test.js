import { describe, test, expect } from 'bun:test';
import { parseBracketAccess } from './lookup.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_RIGHT_BRACKET, TOKEN_COLON, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseBracketAccess', () => {
  const makeTok = (type, value, lineno = 1, colno = 1) => ({ type, value, lineno, colno });

  test('parses bracket access with expression', () => {
    const seq = [
      makeTok(TOKEN_SYMBOL, 'key', 1, 2),
      makeTok(TOKEN_RIGHT_BRACKET, ']', 1, 5),
      makeTok(TOKEN_SYMBOL, 'end', 1, 6),
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return nodes.literal(1, 2, 'key');
      },
    });
    const bracketTok = makeTok('left-bracket', '[', 1, 1);
    const target = { lineno: 1, colno: 0, type: 'symbol', value: 'foo' };

    const result = parseBracketAccess(ctx, bracketTok, target);

    expect(nodes.isLookupVal(result)).toBe(true);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(1);
    expect(result.target).toBe(target);
    expect(nodes.isLiteral(result.val)).toBe(true);
    expect(result.val.value).toBe('key');
  });

  test('parses slice [:]', () => {
    const seq = [
      makeTok(TOKEN_COLON, ':', 1, 2),
      makeTok(TOKEN_RIGHT_BRACKET, ']', 1, 3),
      makeTok(TOKEN_SYMBOL, 'end', 1, 4),
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { throw new Error('should not be called'); },
    });
    const bracketTok = makeTok('left-bracket', '[', 1, 1);
    const target = { lineno: 1, colno: 0, type: 'symbol', value: 'foo' };

    const result = parseBracketAccess(ctx, bracketTok, target);

    expect(nodes.isLookupVal(result)).toBe(true);
    expect(nodes.isSlice(result.val)).toBe(true);
    expect(result.val.start).toBeNull();
    expect(result.val.stop).toBeNull();
    expect(result.val.step).toBeNull();
  });

  test('parses slice [start:stop]', () => {
    const startNode = nodes.literal(1, 2, 0);
    const stopNode = nodes.literal(1, 4, 10);
    const seq = [
      makeTok(TOKEN_SYMBOL, 'start', 1, 2),
      makeTok(TOKEN_COLON, ':', 1, 7),
      makeTok(TOKEN_SYMBOL, 'stop', 1, 8),
      makeTok(TOKEN_RIGHT_BRACKET, ']', 1, 12),
      makeTok(TOKEN_SYMBOL, 'end', 1, 13),
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    let exprCall = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        exprCall++;
        return exprCall === 1 ? startNode : stopNode;
      },
    });
    const bracketTok = makeTok('left-bracket', '[', 1, 1);
    const target = { lineno: 1, colno: 0, type: 'symbol', value: 'foo' };

    const result = parseBracketAccess(ctx, bracketTok, target);

    expect(nodes.isSlice(result.val)).toBe(true);
    expect(result.val.start).toBe(startNode);
    expect(result.val.stop).toBe(stopNode);
    expect(result.val.step).toBeNull();
  });

  test('uses step expression location for slice node', () => {
    const stepNode = nodes.literal(1, 8, 0);
    const seq = [
      makeTok(TOKEN_COLON, ':', 1, 2),
      makeTok(TOKEN_COLON, ':', 1, 3),
      makeTok(TOKEN_SYMBOL, '0', 1, 4),
      makeTok(TOKEN_RIGHT_BRACKET, ']', 1, 5),
      makeTok(TOKEN_SYMBOL, 'end', 1, 6),
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return stepNode;
      },
    });
    const bracketTok = makeTok('left-bracket', '[', 1, 1);
    const target = { lineno: 1, colno: 0, type: 'symbol', value: 'foo' };

    const result = parseBracketAccess(ctx, bracketTok, target);

    expect(nodes.isSlice(result.val)).toBe(true);
    expect(result.val.lineno).toBe(1);
    expect(result.val.colno).toBe(8);
  });
});

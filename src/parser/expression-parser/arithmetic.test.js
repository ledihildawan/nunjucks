import { describe, test, expect } from 'bun:test';
import { parseAdd, parseSub, parseMul, parseDiv, parseFloorDiv, parseMod, parsePow } from './arithmetic.js';
import { Add, Sub, Mul, Div, FloorDiv, Mod, Pow, Literal } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_OPERATOR, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseAdd', () => {
  test('creates Add node for + operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'dummy', lineno: 1, colno: 1 },
      { type: TOKEN_OPERATOR, value: '+', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'dummy', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 1);
    const right = new Literal(1, 5, 2);
    let primaryCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const vals = [left, right];
        nextToken(ctx);
        return vals[primaryCalls++];
      },
      parsePipe: (node) => node,
    });

    const result = parseAdd(ctx);

    expect(result).toBeInstanceOf(Add);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('returns single node without +', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    expect(parseAdd(ctx)).toBe(node);
  });
});

describe('parseSub', () => {
  test('creates Sub node for - operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'dummy', lineno: 1, colno: 1 },
      { type: TOKEN_OPERATOR, value: '-', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'dummy', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 10);
    const right = new Literal(1, 5, 3);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = [left, right];
        nextToken(ctx);
        return v[c++];
      },
      parsePipe: (x) => x,
    });

    const result = parseSub(ctx);

    expect(result).toBeInstanceOf(Sub);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });
});

describe('parseMul', () => {
  test('creates Mul node for * operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '*', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 3);
    const right = new Literal(1, 5, 4);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseMul(ctx);

    expect(result).toBeInstanceOf(Mul);
  });
});

describe('parseDiv', () => {
  test('creates Div node for / operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '/', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 10);
    const right = new Literal(1, 5, 2);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseDiv(ctx);

    expect(result).toBeInstanceOf(Div);
  });
});

describe('parseFloorDiv', () => {
  test('creates FloorDiv node for // operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '//', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 10);
    const right = new Literal(1, 5, 3);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseFloorDiv(ctx);

    expect(result).toBeInstanceOf(FloorDiv);
  });
});

describe('parseMod', () => {
  test('creates Mod node for % operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '%', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 10);
    const right = new Literal(1, 5, 3);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseMod(ctx);

    expect(result).toBeInstanceOf(Mod);
  });
});

describe('parsePow', () => {
  test('creates Pow node for ** operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '**', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 2);
    const right = new Literal(1, 5, 3);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parsePow(ctx);

    expect(result).toBeInstanceOf(Pow);
  });
});

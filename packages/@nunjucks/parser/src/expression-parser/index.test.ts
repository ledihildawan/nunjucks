import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { parseExpression, parsePrimary } from './index.ts';
import { createParser } from '../index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parse = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx); 
  return parseExpression(ctx);
};

const parsePrim = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx); 
  return parsePrimary(ctx);
};

describe('parseExpression: literals', () => {
  test('number literal', () => {
    const node = parse('42');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe(42);
  });
  test('string literal', () => {
    const node = parse('"hello"');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe('hello');
  });
  test('boolean true', () => {
    const node = parse('true');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe(true);
  });
  test('boolean false', () => {
    const node = parse('false');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe(false);
  });
});

describe('parseExpression: symbols', () => {
  test('simple identifier', () => {
    const node = parse('myVar');
    expect(getNodeTypeName(node)).toBe('symbol');
    expect(node.value).toBe('myVar');
  });
});

describe('parseExpression: arithmetic', () => {
  test('addition', () => {
    expect(getNodeTypeName(parse('1 + 2'))).toBe('add');
  });
  test('subtraction', () => {
    expect(getNodeTypeName(parse('1 - 2'))).toBe('sub');
  });
  test('multiplication', () => {
    expect(getNodeTypeName(parse('2 * 3'))).toBe('mul');
  });
  test('precedence: mul before add', () => {
    expect(getNodeTypeName(parse('1 + 2 * 3'))).toBe('add');
  });
  test('power', () => {
    expect(getNodeTypeName(parse('2 ** 3'))).toBe('pow');
  });
  test('floor division', () => {
    expect(getNodeTypeName(parse('7 // 2'))).toBe('floorDiv');
  });
  test('modulo', () => {
    expect(getNodeTypeName(parse('7 % 3'))).toBe('mod');
  });
});

describe('parseExpression: comparison', () => {
  test('less than', () => {
    expect(getNodeTypeName(parse('1 < 2'))).toBe('compare');
  });
  test('equals', () => {
    expect(getNodeTypeName(parse('1 == 1'))).toBe('compare');
  });
});

describe('parseExpression: logical', () => {
  test('and', () => {
    expect(getNodeTypeName(parse('true and false'))).toBe('and');
  });
  test('or', () => {
    expect(getNodeTypeName(parse('true or false'))).toBe('or');
  });
  test('not', () => {
    expect(getNodeTypeName(parse('not true'))).toBe('not');
  });
  test('nullish coalesce', () => {
    expect(getNodeTypeName(parse('a ?? b'))).toBe('nullishCoalesce');
  });
});

describe('parseExpression: member access', () => {
  test('dot lookup', () => {
    expect(getNodeTypeName(parse('a.b'))).toBe('lookupVal');
  });
  test('bracket lookup', () => {
    expect(getNodeTypeName(parse('a["b"]'))).toBe('lookupVal');
  });
  test('chained lookup', () => {
    expect(getNodeTypeName(parse('a.b.c'))).toBe('lookupVal');
  });
});

describe('parseExpression: function call', () => {
  test('simple call', () => {
    expect(getNodeTypeName(parse('greet()'))).toBe('funCall');
  });
  test('call with args', () => {
    expect(getNodeTypeName(parse('greet("World")'))).toBe('funCall');
  });
  test('call with multiple args', () => {
    expect(getNodeTypeName(parse('add(1, 2, 3)'))).toBe('funCall');
  });
});

describe('parseExpression: pipe forward', () => {
  test('simple pipe', () => {
    expect(getNodeTypeName(parse('x |> upper'))).toBe('pipe');
  });
  test('chained pipe', () => {
    expect(getNodeTypeName(parse('x |> upper |> lower'))).toBe('pipe');
  });
});

describe('parseExpression: is test', () => {
  test('is defined', () => {
    expect(getNodeTypeName(parse('x is defined'))).toBe('test');
  });
  test('is odd', () => {
    expect(getNodeTypeName(parse('x is odd'))).toBe('test');
  });
  test('is not defined', () => {
    expect(getNodeTypeName(parse('x is not defined'))).toBe('not');
  });
});

describe('parseExpression: unary', () => {
  test('negation', () => {
    expect(getNodeTypeName(parse('-5'))).toBe('neg');
  });
  test('positive', () => {
    expect(getNodeTypeName(parse('+5'))).toBe('pos');
  });
});

describe('parseExpression: containers', () => {
  test('array literal', () => {
    expect(getNodeTypeName(parsePrim('[1, 2, 3]'))).toBe('array');
  });
  test('dict literal', () => {
    expect(getNodeTypeName(parsePrim('{a: 1}'))).toBe('dict');
  });
});

describe('parseExpression: inline if', () => {
  test('ternary', () => {
    expect(getNodeTypeName(parse('true ? "yes" : "no"'))).toBe('inlineIf');
  });
});

describe('parsePrimary: grouping', () => {
  test('parenthesized expression', () => {
    expect(getNodeTypeName(parsePrim('(1 + 2)'))).toBe('group');
  });
});

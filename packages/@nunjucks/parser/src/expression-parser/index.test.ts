import { describe, expect, test } from 'bun:test';
import { createTokenizer, TOKEN_REGEX, type Token } from '@nunjucks/lexer';
import { isErr, isOk } from '@nunjucks/lib';
import { getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull, pushToken } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseExpression, parsePrimary } from './index.ts';

const parse = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(tk);
  nextTokenOrNull(ctx);
  return unwrap(parseExpression(ctx));
};

const parsePrim = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(tk);
  nextTokenOrNull(ctx);
  return unwrap(parsePrimary(ctx));
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

// WHY: the bundled tokenizer does not emit TOKEN_REGEX today; it is part of the token
// contract any tokenizer/extension producer may feed, so these tests inject the token
// directly to pin the parse boundary (including its ReDoS length cap).
const makeRegexContext = (body: string, flags = '') => {
  const tk = createTokenizer('{{ }}');
  const ctx = createParser(tk);
  nextTokenOrNull(ctx);
  const regexToken: Token = { type: TOKEN_REGEX, value: { body, flags }, lineno: 0, colno: 0 };
  pushToken(ctx, regexToken);
  return ctx;
};

describe('parseExpression: regex literal tokens', () => {
  test('parses a short regex literal token', () => {
    const node = unwrap(parsePrimary(makeRegexContext('^a+$', 'u')));
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBeInstanceOf(RegExp);
  });
  test('rejects an overly long regex literal token (ReDoS cap)', () => {
    const result = parsePrimary(makeRegexContext('a'.repeat(257)));
    expect(isErr(result)).toBe(true);
  });
  test('rejects nested-quantifier regex literals (ReDoS guard)', () => {
    expect(isErr(parsePrimary(makeRegexContext('(a+)+')))).toBe(true);
    expect(isErr(parsePrimary(makeRegexContext('^(\\d+\\s*)+$')))).toBe(true);
    expect(isErr(parsePrimary(makeRegexContext('(a{1,3})+')))).toBe(true);
  });
  test('accepts linear quantified regex literals', () => {
    expect(isOk(parsePrimary(makeRegexContext('(a{2})+')))).toBe(true);
    expect(isOk(parsePrimary(makeRegexContext('(ab)+c*')))).toBe(true);
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

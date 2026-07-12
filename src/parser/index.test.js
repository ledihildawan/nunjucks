import { describe, test, expect } from 'bun:test';
import { createParser, parse } from './index.js';
import { lex } from '../lexer/tokenizer.js';
import {
  TOKEN_DATA, TOKEN_SYMBOL, TOKEN_BLOCK_START, TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
} from '../lexer/token-types.js';
import { getNodeTypeName } from '../nodes/index.js';

describe('Parser', () => {
  const tokens = lex('Hello {{ name }}');
  let parser;

  test('init sets properties', () => {
    parser = createParser();
    parser.init(tokens);
    expect(parser.tokens).toBe(tokens);
    expect(parser.peeked).toBeNull();
    expect(parser.breakOnBlocks).toBeNull();
    expect(parser.dropLeadingWhitespace).toBe(false);
    expect(parser.extensions).toEqual([]);
  });

  test('nextToken returns a token', () => {
    parser = createParser();
    parser.init(lex('{{ x }}'));
    const tok = parser.nextToken();
    expect(tok).toBeTruthy();
    expect(tok.type).toBeString();
  });

  test('peekToken returns next token without consuming', () => {
    parser = createParser();
    parser.init(lex('Hello world'));
    const first = parser.peekToken();
    const second = parser.peekToken();
    expect(first).toBe(second);
    expect(first.type).toBe(TOKEN_DATA);
  });

  test('pushToken puts token back', () => {
    parser = createParser();
    parser.init(lex('Hello world'));
    const tok = parser.nextToken();
    parser.pushToken(tok);
    expect(parser.nextToken()).toBe(tok);
  });

  test('skip advances past a token type', () => {
    parser = createParser();
    parser.init(lex('Hello world'));
    parser.skip(TOKEN_DATA);
    expect(parser.peekToken()).toBeNull();
  });

  test('expect returns matching token', () => {
    parser = createParser();
    parser.init(lex('Hello'));
    const tok = parser.expect(TOKEN_DATA);
    expect(tok.value).toBe('Hello');
  });

  test('expect throws on mismatch', () => {
    parser = createParser();
    parser.init(lex('Hello'));
    expect(() => parser.expect(TOKEN_SYMBOL)).toThrow();
  });

  test('skipValue advances past matching token', () => {
    parser = createParser();
    parser.init(lex('{% if %}'));
    parser.skip(TOKEN_BLOCK_START);
    parser.skipValue(TOKEN_SYMBOL, 'if');
    expect(parser.peekToken().type).toBe(TOKEN_BLOCK_END);
  });

  test('skipSymbol advances past symbol', () => {
    parser = createParser();
    parser.init(lex('{% for x %}'));
    parser.skip(TOKEN_BLOCK_START);
    parser.skipSymbol('for');
    expect(parser.peekToken().value).toBe('x');
  });

  test('advanceAfterBlockEnd skips block end tokens', () => {
    parser = createParser();
    parser.init(lex('{% if x %}'));
    parser.skip(TOKEN_BLOCK_START);
    parser.skipSymbol('if');
    parser.skip(TOKEN_SYMBOL);
    parser.advanceAfterBlockEnd('if');
    expect(parser.peekToken()).toBeNull();
  });

  test('advanceAfterVariableEnd skips variable end tokens', () => {
    parser = createParser();
    parser.init(lex('{{ x }}'));
    parser.skip(TOKEN_VARIABLE_START);
    parser.skip(TOKEN_SYMBOL);
    parser.advanceAfterVariableEnd();
    expect(parser.peekToken()).toBeNull();
  });

  test('parse returns NodeList', () => {
    parser = createParser();
    parser.init(lex('Hello'));
    const result = parser.parse();
    expect(getNodeTypeName(result)).toBe('NodeList');
  });

  test('parseAsRoot returns Root', () => {
    parser = createParser();
    parser.init(lex('Hello'));
    const result = parser.parseAsRoot();
    expect(getNodeTypeName(result)).toBe('Root');
  });
});

describe('parse function', () => {
  test('parses plain text', () => {
    const result = parse('Hello world');
    expect(getNodeTypeName(result)).toBe('Root');
    expect(result.children.length).toBe(1);
  });

  test('parses variable expression', () => {
    const result = parse('{{ name }}');
    expect(getNodeTypeName(result)).toBe('Root');
  });

  test('parses block', () => {
    const result = parse('{% if x %}y{% endif %}');
    expect(getNodeTypeName(result)).toBe('Root');
  });

  test('passes extensions to parser', () => {
    const ext = { tags: ['custom'], parse: () => null };
    const result = parse('Hello', [ext]);
    expect(getNodeTypeName(result)).toBe('Root');
  });

  test('passes opts to lexer', () => {
    const result = parse('Hello', undefined, { autoescape: true });
    expect(getNodeTypeName(result)).toBe('Root');
  });
});

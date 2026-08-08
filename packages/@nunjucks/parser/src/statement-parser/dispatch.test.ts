import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseStatement } from './index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { ParserExtension, ParserContext } from '../cursor.ts';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const ctxFor = (src: string, extensions: ParserExtension[] = []): ParserContext => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  ctx.extensions = extensions;
  nextTokenOrNull(ctx);
  return ctx;
};

describe('parseStatement', () => {
  test('dispatches to the registered parser for a known tag', () => {
    const ctx = ctxFor('{% if true %}x{% endif %}');
    const node = unwrap(parseStatement(ctx));
    expect(getNodeTypeName(node as never)).toBe('if');
  });

  test('returns null when the tag matches breakOn', () => {
    const ctx = ctxFor('{% endif %}');
    expect(unwrap(parseStatement(ctx, ['endif']))).toBeNull();
  });

  test('throws an error for an unknown tag', () => {
    const ctx = ctxFor('{% bogusTag %}');
    expect(() => unwrap(parseStatement(ctx))).toThrow(/unknown block tag/);
  });

  test('dispatches to a registered extension parser', () => {
    const extension: ParserExtension = {
      tags: ['customTag'],
      parse: () => null,
    };
    const ctx = ctxFor('{% customTag %}', [extension]);
    expect(unwrap(parseStatement(ctx))).toBeNull();
  });

  test('throws when the token stream starts with a non-symbol token', () => {
    const ctx = ctxFor('{% 42 %}');
    expect(() => unwrap(parseStatement(ctx))).toThrow();
  });
});

import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { buildDefaultBody, parseSlottedBody } from './slots.ts';

const makeCtx = (src: string) => createParser(createTokenizer(src));

const parseBody = (src: string) => {
  const ctx = makeCtx(`{% component x %}${src}{% endcomponent %}`);
  nextTokenOrNull(ctx);
  nextTokenOrNull(ctx);
  nextTokenOrNull(ctx);
  nextTokenOrNull(ctx);
  return { ctx, body: unwrap(parseSlottedBody(ctx, 'endcomponent')) };
};

describe('parseSlottedBody', () => {
  test('collects plain content into defaultParts', () => {
    const { body } = parseBody('hello');
    expect(body.defaultParts.length).toBeGreaterThan(0);
    expect(body.namedSlots).toHaveLength(0);
    expect(body.implicitSlots).toHaveLength(0);
  });

  test('collects named slots separately', () => {
    const { body } = parseBody('{% slot header %}head{% endslot %}');
    expect(body.defaultParts).toHaveLength(0);
    expect(body.namedSlots).toHaveLength(1);
    expect(body.namedSlots[0]?.name).toBe('header');
  });

  test('parses slot params', () => {
    const { body } = parseBody('{% slot item(a, b) %}x{% endslot %}');
    expect(body.namedSlots[0]?.params).toEqual(['a', 'b']);
  });

  test('routes default-named slots into implicitSlots', () => {
    const { body } = parseBody('{% slot default %}x{% endslot %}');
    expect(body.implicitSlots).toHaveLength(1);
    expect(body.implicitSlots[0]?.name).toBe('default');
  });

  test('anonymous {% slot %} defaults its name (does not eat the block end)', () => {
    const { body } = parseBody('{% slot %}x{% endslot %}');
    expect(body.implicitSlots).toHaveLength(1);
    expect(body.implicitSlots[0]?.name).toBe('default');
  });
});

describe('buildDefaultBody', () => {
  const ZERO_LOC = loc({ lineno: 0, colno: 0 });

  test('returns an empty output for no parts', () => {
    const node = buildDefaultBody([], ZERO_LOC);
    expect(getNodeTypeName(node)).toBe('output');
    expect((node as { children: readonly Node[] }).children).toHaveLength(1);
  });

  test('returns the single part directly', () => {
    const part = { type: 'symbol', value: 'a' } as unknown as Node;
    expect(buildDefaultBody([part], ZERO_LOC)).toBe(part);
  });

  test('wraps multiple parts in a nodeList', () => {
    const a = { type: 'symbol', value: 'a' } as unknown as Node;
    const b = { type: 'symbol', value: 'b' } as unknown as Node;
    const node = buildDefaultBody([a, b], ZERO_LOC);
    expect(getNodeTypeName(node)).toBe('nodeList');
  });
});

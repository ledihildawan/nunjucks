import { describe, test, expect } from 'bun:test';
import { parseStatement } from './index.js';
import { Parser } from '../index.js';
import { lex } from '../../lexer/tokenizer.js';
import { TOKEN_BLOCK_START } from '../../lexer/token-types.js';

const makeParser = (src) => {
  const p = new Parser();
  p.init(lex(src));
  return p;
};

const advanceToStatement = (p) => {
  p.skip(TOKEN_BLOCK_START);
  return p;
};

describe('parseStatement dispatch', () => {
  test('dispatches raw', () => {
    const p = advanceToStatement(makeParser('{% raw %}{{ x }}{% endraw %}'));
    const node = parseStatement(p);
    expect(node).toBeTruthy();
  });

  test('dispatches verbatim', () => {
    const p = advanceToStatement(makeParser('{% verbatim %}{{ x }}{% endverbatim %}'));
    const node = parseStatement(p);
    expect(node).toBeTruthy();
  });

  test('dispatches if', () => {
    const p = advanceToStatement(makeParser('{% if x %}y{% endif %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('If');
  });

  test('dispatches for', () => {
    const p = advanceToStatement(makeParser('{% for x in y %}z{% endfor %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('For');
  });

  test('dispatches block', () => {
    const p = advanceToStatement(makeParser('{% block name %}content{% endblock %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Block');
  });

  test('dispatches extends', () => {
    const p = advanceToStatement(makeParser('{% extends "base.njk" %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Extends');
  });

  test('dispatches include', () => {
    const p = advanceToStatement(makeParser('{% include "header.njk" %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Include');
  });

  test('dispatches set', () => {
    const p = advanceToStatement(makeParser('{% set x = 1 %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Set');
  });

  test('dispatches macro', () => {
    const p = advanceToStatement(makeParser('{% macro mymacro() %}body{% endmacro %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Macro');
  });

  test('dispatches call', () => {
    const p = advanceToStatement(makeParser('{% call block() %}body{% endcall %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Output');
  });

  test('dispatches import', () => {
    const p = advanceToStatement(makeParser('{% import "macros.njk" as m %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Import');
  });

  test('dispatches from', () => {
    const p = advanceToStatement(makeParser('{% from "macros.njk" import mymacro %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('FromImport');
  });

  test('dispatches filter', () => {
    const p = advanceToStatement(makeParser('{% filter upper %}text{% endfilter %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Output');
  });

  test('dispatches switch', () => {
    const p = advanceToStatement(makeParser('{% switch x %}{% case 1 %}{% endswitch %}'));
    const node = parseStatement(p);
    expect(node.typename).toBe('Switch');
  });

  test('fails on unknown tag', () => {
    const p = advanceToStatement(makeParser('{% unknown_tag %}'));
    expect(() => parseStatement(p)).toThrow();
  });

  test('fails on non-symbol token', () => {
    const p = makeParser('{{ x }}');
    expect(() => parseStatement(p)).toThrow('tag name expected');
  });

  test('returns null for breakOnBlocks match', () => {
    const p = advanceToStatement(makeParser('{% else %}'));
    p.breakOnBlocks = ['else'];
    const node = parseStatement(p);
    expect(node).toBeNull();
  });

  test('dispatches to extension tags', () => {
    const ext = { tags: ['custom'], parse: () => ({ typename: 'Custom' }) };
    const p = advanceToStatement(makeParser('{% custom %}'));
    p.extensions = [ext];
    const node = parseStatement(p);
    expect(node.typename).toBe('Custom');
  });

  test('fails when no extension matches', () => {
    const ext = { tags: ['other'], parse: () => null };
    const p = advanceToStatement(makeParser('{% unknown %}'));
    p.extensions = [ext];
    expect(() => parseStatement(p)).toThrow('unknown block tag');
  });
});

describe('exported parsers', () => {
  const parsers = {
    parseFor: true, parseMacro: true, parseCall: true,
    parseImport: true, parseFrom: true, parseBlock: true,
    parseExtends: true, parseInclude: true, parseIf: true,
    parseSet: true, parseSwitch: true, parseRaw: true,
    parseFilterStatement: true, parseWithContext: true,
  };

  Object.entries(parsers).forEach(([name]) => {
    test(`exports ${name}`, async () => {
      const mod = await import('./index.js');
      expect(mod[name]).toBeFunction();
    });
  });
});

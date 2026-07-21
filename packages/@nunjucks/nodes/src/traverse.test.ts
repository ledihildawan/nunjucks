import { describe, test, expect } from 'bun:test';
import { parse } from '@nunjucks/parser';
import { walk, findAll, findFirst, count, iterateNodes, filterNodes, addChild, getType, getFields_ } from './traverse.ts';

// Use a real parsed AST for reliable structure
const ast = parse('{{ x + 1 }}\n{% if x %}{{ y }}{% endif %}');

describe('getType / getFields_', () => {
  test('getType returns node type string', () => {
    expect(getType(ast)).toBeTruthy();
    expect(typeof getType(ast)).toBe('string');
  });

  test('getFields_ returns field names', () => {
    const fields = getFields_(ast);
    expect([...fields]).toContain('children');
  });
});

describe('addChild', () => {
  test('appends child immutably', () => {
    const list = ast;
    const before = (list as unknown as { children: unknown[] }).children.length;
    const child = { type: 'literal', lineno: 0, colno: 0, fields: ['value'], value: 'x' };
    const result = addChild(list, child as never);
    expect((result as unknown as { children: unknown[] }).children.length).toBe(before + 1);
    expect((list as unknown as { children: unknown[] }).children.length).toBe(before);
  });
});

describe('findAll', () => {
  test('finds all nodes of a type', () => {
    const symbols = findAll(ast, (n) => n.type === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
  });

  test('returns empty array for no match', () => {
    expect(findAll(ast, (n) => n.type === 'nonexistent')).toEqual([]);
  });
});

describe('findFirst', () => {
  test('finds first match', () => {
    const first = findFirst(ast, (n) => n.type === 'literal');
    expect(first).toBeDefined();
    expect(first?.type).toBe('literal');
  });

  test('returns undefined for no match', () => {
    expect(findFirst(ast, (n) => n.type === 'nonexistent')).toBeUndefined();
  });
});

describe('count', () => {
  test('counts all nodes (at least 3)', () => {
    expect(count(ast)).toBeGreaterThan(2);
  });

  test('counts with predicate', () => {
    const symbolCount = count(ast, (n) => n.type === 'symbol');
    expect(symbolCount).toBeGreaterThan(0);
  });
});

describe('iterateNodes', () => {
  test('yields all nodes as generator', () => {
    const all = [...iterateNodes(ast)];
    expect(all.length).toBeGreaterThan(2);
    expect(all[0]).toBeDefined();
  });
});

describe('filterNodes', () => {
  test('filters nodes by predicate', () => {
    const literals = [...filterNodes(ast, (n) => n.type === 'literal')];
    expect(literals.length).toBeGreaterThan(0);
    expect(literals.every((n) => n.type === 'literal')).toBe(true);
  });
});

describe('walk', () => {
  test('visits and returns root node', () => {
    const result = walk(ast, () => {});
    expect(result).toBeDefined();
    expect(getType(result)).toBeTruthy();
  });
});

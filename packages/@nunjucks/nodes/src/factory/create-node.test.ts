import { describe, expect, test } from 'bun:test';
import { type Loc, loc, ZERO_LOC } from '@nunjucks/shared';
import { FIELDS, T } from '../types/index.ts';
import { literal, symbol } from './atomic.ts';
import { createNode } from './create-node.ts';

const customLoc: Loc = loc({ lineno: 10, colno: 20 });

describe('createNode', () => {
  test('stamps the requested type tag', () => {
    expect(createNode(T.LITERAL, ZERO_LOC).type).toBe('literal');
    expect(createNode(T.FUN_CALL, ZERO_LOC).type).toBe('funCall');
    expect(createNode(T.HOLE, ZERO_LOC).type).toBe('hole');
  });

  test('wires lineno and colno from the provided Loc', () => {
    const node = createNode(T.LITERAL, customLoc);
    expect(node.lineno).toBe(10);
    expect(node.colno).toBe(20);
  });

  test('flattens ZERO_LOC to line zero, column zero', () => {
    const node = createNode(T.LITERAL, ZERO_LOC);
    expect(node.lineno).toBe(0);
    expect(node.colno).toBe(0);
  });

  test('reads coordinates from the Loc, not from the data bag', () => {
    const node = createNode(T.LITERAL, customLoc, { value: 'x' });
    expect(node.lineno).toBe(customLoc.lineno);
    expect(node.colno).toBe(customLoc.colno);
  });

  test('spreads caller data over the defaults so any slot can be filled', () => {
    const name = symbol(ZERO_LOC, 'greet');
    const arg = literal(ZERO_LOC, 'world');
    const node = createNode(T.FUN_CALL, customLoc, { name, args: [arg] });
    expect(node.name).toBe(name);
    expect(node.args).toEqual([arg]);
  });

  test('produces a fresh object per call — no shared mutable identity', () => {
    const first = createNode(T.LITERAL, ZERO_LOC, { value: 'a' });
    const second = createNode(T.LITERAL, ZERO_LOC, { value: 'a' });
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('createNode fields wiring', () => {
  type ProbedType =
    | typeof T.LITERAL
    | typeof T.SYMBOL
    | typeof T.HOLE
    | typeof T.FUN_CALL
    | typeof T.LOOKUP_VAL
    | typeof T.ADD;

  const fieldProbeCases: ReadonlyArray<{
    typename: ProbedType;
    expectedFields: readonly string[];
  }> = [
    { typename: T.LITERAL, expectedFields: ['value'] },
    { typename: T.SYMBOL, expectedFields: ['value'] },
    { typename: T.HOLE, expectedFields: [] },
    { typename: T.FUN_CALL, expectedFields: ['name', 'args'] },
    { typename: T.LOOKUP_VAL, expectedFields: ['target', 'val'] },
    { typename: T.ADD, expectedFields: ['left', 'right', 'operator'] },
  ];

  fieldProbeCases.forEach(({ typename, expectedFields }) => {
    test(`embeds the frozen FIELDS slot list for ${typename}`, () => {
      const node = createNode(typename, ZERO_LOC);
      expect(node.fields).toBe(FIELDS[typename]);
      expect(node.fields).toEqual(expectedFields);
      expect(Object.isFrozen(node.fields)).toBe(true);
    });
  });

  test('embeds the FIELDS array by reference, not as a copy', () => {
    const first = createNode(T.LITERAL, ZERO_LOC);
    const second = createNode(T.LITERAL, ZERO_LOC);
    expect(first.fields).toBe(second.fields);
    expect(first.fields).toBe(FIELDS[T.LITERAL]);
  });

  test('refuses mutation of the shared fields array', () => {
    const node = createNode(T.LITERAL, ZERO_LOC);
    const fields = node.fields ?? [];
    expect(() => {
      (fields as string[]).push('children');
    }).toThrow(TypeError);
    expect(node.fields).toEqual(['value']);
  });
});

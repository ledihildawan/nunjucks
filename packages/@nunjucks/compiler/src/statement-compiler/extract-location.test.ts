import { describe, test, expect } from 'bun:test';
import { extractVarName } from './extract-location.ts';
import { symbol, literal, lookupVal, funCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';

describe('extractVarName', () => {
  test('returns the symbol value for a simple symbol node', () => {
    expect(extractVarName(symbol(ZERO_LOC, 'foo'))).toBe('foo');
  });

  describe('lookup traversal', () => {
    const lookupCases: ReadonlyArray<{ label: string; node: Node; expected: string }> = [
      {
        label: 'single lookup foo.bar',
        node: lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'foo'), val: literal(ZERO_LOC, 'bar') }),
        expected: 'foo.bar',
      },
      {
        label: 'nested lookup foo.bar.baz',
        node: lookupVal(ZERO_LOC, {
          target: lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'foo'), val: literal(ZERO_LOC, 'bar') }),
          val: literal(ZERO_LOC, 'baz'),
        }),
        expected: 'foo.bar.baz',
      },
      {
        label: 'lookup with a symbol property user.name',
        node: lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'user'), val: symbol(ZERO_LOC, 'name') }),
        expected: 'user.name',
      },
      {
        label: 'lookup with a numeric literal property keeps the 0 (nullish, not falsy)',
        node: lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'foo'), val: literal(ZERO_LOC, 0) }),
        expected: 'foo.0',
      },
    ];
    lookupCases.forEach(({ label, node, expected }) => {
      test(label, () => {
        expect(extractVarName(node)).toBe(expected);
      });
    });
  });

  describe('returns null for non-extractable nodes', () => {
    const nullCases: ReadonlyArray<{ label: string; node: Node }> = [
      { label: 'bare literal', node: literal(ZERO_LOC, 42) },
      { label: 'function call (neither symbol nor lookup)', node: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'fn'), args: [] }) },
      { label: 'lookup whose target is a literal (no base symbol to walk)', node: lookupVal(ZERO_LOC, { target: literal(ZERO_LOC, 'x'), val: literal(ZERO_LOC, 'y') }) },
    ];
    nullCases.forEach(({ label, node }) => {
      test(label, () => {
        expect(extractVarName(node)).toBeNull();
      });
    });
  });
});

import { describe, expect, test } from 'bun:test';
import { output, symbol, templateData } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import {
  arraySlice,
  asArrayPattern,
  asObjectPattern,
  objectRest,
  patternPropertyKey,
  safeArrayIndex,
  safeMemberLookup,
} from './pattern-emitters.ts';

const nodeWithChildren = output(ZERO_LOC, [templateData(ZERO_LOC, 'x')]);

describe('patternPropertyKey', () => {
  test('passes a string key through', () => {
    expect(patternPropertyKey('name')).toBe('name');
  });

  test('reads the value of a symbol key', () => {
    expect(patternPropertyKey(symbol(ZERO_LOC, 'alias'))).toBe('alias');
  });

  test('returns null for non-string non-symbol keys', () => {
    expect(patternPropertyKey(42)).toBeNull();
    expect(patternPropertyKey(null)).toBeNull();
  });
});

describe('asObjectPattern / asArrayPattern', () => {
  test('coerces a children-bearing node into the requested pattern shape', () => {
    expect(asObjectPattern(nodeWithChildren)?.type).toBe('objectPattern');
    expect(asArrayPattern(nodeWithChildren)?.type).toBe('arrayPattern');
  });

  test('returns a pattern node unchanged', () => {
    const pattern = asObjectPattern(nodeWithChildren);
    if (pattern === null) {
      throw new Error('expected a coerced pattern node');
    }
    expect(asObjectPattern(pattern)).toBe(pattern);
  });

  test('returns null for children-less nodes', () => {
    expect(asObjectPattern(symbol(ZERO_LOC, 'x'))).toBeNull();
    expect(asArrayPattern(symbol(ZERO_LOC, 'x'))).toBeNull();
  });
});

describe('source emitters', () => {
  test('safeMemberLookup emits a JSON-stringified key lookup', () => {
    expect(safeMemberLookup('src', 'k"ey')).toBe('runtime.optionalMemberLookup(src, "k\\"ey")');
  });

  test('safeArrayIndex guards non-array sources', () => {
    expect(safeArrayIndex('arr', 2)).toContain('Array.isArray(arr)');
    expect(safeArrayIndex('arr', 2)).toContain('arr[2]');
  });

  test('arraySlice emits a guarded slice', () => {
    expect(arraySlice('src', 1)).toContain('src.slice(1)');
  });

  test('objectRest copies own properties only (hasOwn guard, no bare for-in)', () => {
    const emitted = objectRest('src', 'restId');
    expect(emitted).toContain('Object.hasOwn(src, __k)');
    expect(emitted).toContain('restId[__k] = src[__k]');
  });
});

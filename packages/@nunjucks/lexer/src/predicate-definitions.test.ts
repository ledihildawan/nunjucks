import { describe, expect, test } from 'bun:test';
import { isTestKeyword } from './predicate-definitions.ts';

describe('isTestKeyword', () => {
  test.each([
    'defined',
    'undefined',
    'null',
    'none',
    'truthy',
    'falsy',
    'true',
    'false',
    'boolean',
    'string',
    'number',
    'integer',
    'float',
    'array',
    'object',
    'function',
    'odd',
    'even',
    'positive',
    'negative',
    'empty',
    'safe',
    'escaped',
    'matches',
  ])('returns true for "%s"', (kw) => {
    expect(isTestKeyword(kw)).toBe(true);
  });

  test.each(['foo', 'myTest', '', 'True', 'DEFINED', 'is_null'])('returns false for "%s"', (kw) => {
    expect(isTestKeyword(kw)).toBe(false);
  });
});

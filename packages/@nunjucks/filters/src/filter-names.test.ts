import { BUILTIN_FILTER_NAMES } from '@nunjucks/shared';
import { describe, expect, test } from 'bun:test';
import { BUILTIN_FILTERS } from './filter-names.ts';

// WHY: BUILTIN_FILTER_NAMES lives in @nunjucks/shared as a static list so validators can
// reserve filter names without loading the filters barrel (and its DOMPurify shell). This
// drift pin replaces the old derivation: adding a filter without registering its name in
// shared/src/filter-names.ts fails here.
describe('BUILTIN_FILTER_NAMES drift pin', () => {
  test('matches the keys of the assembled BUILTIN_FILTERS registry exactly', () => {
    expect([...BUILTIN_FILTER_NAMES].sort()).toEqual(Object.keys(BUILTIN_FILTERS).sort());
  });

  test('contains no duplicates', () => {
    expect(new Set(BUILTIN_FILTER_NAMES).size).toBe(BUILTIN_FILTER_NAMES.length);
  });
});

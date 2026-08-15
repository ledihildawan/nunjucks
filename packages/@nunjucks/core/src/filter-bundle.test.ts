import { getReservedKeywords } from '@nunjucks/validators';
import { expect, test } from 'bun:test';
import { defaultFilterBundle } from './filter-bundle.ts';

// WHY: RESERVED_KEYWORDS (validators) must cover every built-in filter name so a user-supplied
// filter can never shadow the engine surface. The two lists live in different packages (validators
// cannot import filters without a dependency cycle), so this test is the single drift guard.
test('every built-in filter name is reserved', () => {
  const reservedNames = new Set(getReservedKeywords());
  const builtInNames = Object.keys(defaultFilterBundle.filters);

  expect(builtInNames.length).toBeGreaterThan(0);
  for (const filterName of builtInNames) {
    expect(reservedNames.has(filterName)).toBeTrue();
  }
});

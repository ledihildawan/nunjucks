import { getReservedKeywords } from '@nunjucks/validators';
import { expect, test } from 'bun:test';
import { defaultFilterBundle } from './filter-bundle.ts';

// WHY: both sides now derive from @nunjucks/filters filter-names.ts (SSOT), so this test
// cannot fail via drift — it stays as a contract pin proving the engine's registered
// filter surface is fully reserved, whatever filters adds in the future.
test('every built-in filter name is reserved', () => {
  const reservedNames = new Set(getReservedKeywords());
  const builtInNames = Object.keys(defaultFilterBundle.filters);

  expect(builtInNames.length).toBeGreaterThan(0);
  for (const filterName of builtInNames) {
    expect(reservedNames.has(filterName)).toBeTrue();
  }
});

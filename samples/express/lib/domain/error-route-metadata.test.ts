import { describe, expect, test } from 'bun:test';
import { errorGroups } from './error-route-metadata.ts';

// WHY: the error-route catalog drives both the /errors index page and the audit script —
// a duplicated or malformed path silently shadows a demo route, so the registry itself
// is validated here (pure data, no I/O).
describe('errorGroups registry invariants', () => {
  const allRoutes = errorGroups.flatMap((group) => group.items.map((item) => item.path));

  test('every group has a non-empty name and a valid tier', () => {
    const validTiers = new Set(['tier 1', 'tier 2', 'tier 3', '—']);
    expect(errorGroups.every((group) => group.name.length > 0)).toBe(true);
    expect(errorGroups.every((group) => validTiers.has(group.tier))).toBe(true);
  });

  test('group names are unique', () => {
    const names = errorGroups.map((group) => group.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('every item has a non-empty path and description', () => {
    expect(allRoutes.length).toBeGreaterThan(0);
    expect(
      errorGroups.every((group) =>
        group.items.every((item) => item.path.length > 0 && item.desc.length > 0)
      )
    ).toBe(true);
  });

  test('route paths are unique across all groups', () => {
    expect(new Set(allRoutes).size).toBe(allRoutes.length);
  });
});

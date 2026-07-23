import { describe, test, expect } from 'bun:test';
import { groupby } from './object.ts';

describe('groupby', () => {
  test('groups by string attribute', () => {
    const items = [
      { type: 'fruit', name: 'apple' },
      { type: 'fruit', name: 'banana' },
      { type: 'veg', name: 'carrot' },
    ];
    const r = groupby(items, 'type') as Record<string, { type: string; name: string }[]>;
    expect(Object.keys(r).sort()).toEqual(['fruit', 'veg']);
    expect(r.fruit).toHaveLength(2);
    expect(r.veg).toHaveLength(1);
  });

  test('groups numbers by value', () => {
    const items = [{ n: 1 }, { n: 2 }, { n: 1 }];
    const r = groupby(items, 'n') as Record<string, { n: number }[]>;
    expect(r['1']).toHaveLength(2);
    expect(r['2']).toHaveLength(1);
  });
});

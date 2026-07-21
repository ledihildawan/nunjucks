import { describe, test, expect } from 'bun:test';
import { dictsort, groupby } from './object.ts';

describe('dictsort', () => {
  test('sorts by key ascending', () => {
    const r = dictsort({ banana: 1, apple: 2, cherry: 3 });
    expect(r.map(([k]) => k)).toEqual(['apple', 'banana', 'cherry']);
  });

  test('sorts by value when by=value', () => {
    const r = dictsort({ a: 3, b: 1, c: 2 }, undefined, 'value');
    expect(r.map(([, v]) => v)).toEqual([1, 2, 3]);
  });

  test('case insensitive by default', () => {
    const r = dictsort({ Banana: 1, apple: 2 });
    expect(r.map(([k]) => k)).toEqual(['apple', 'Banana']);
  });

  test('case sensitive when requested', () => {
    const r = dictsort({ banana: 1, Apple: 2 }, true);
    expect(r.map(([k]) => k)).toEqual(['Apple', 'banana']);
  });
});

describe('groupby', () => {
  test('groups by string attribute', () => {
    const items = [
      { type: 'fruit', name: 'apple' },
      { type: 'fruit', name: 'banana' },
      { type: 'veg', name: 'carrot' },
    ];
    const r = groupby(items, 'type');
    expect(Object.keys(r).sort()).toEqual(['fruit', 'veg']);
    expect(r.fruit).toHaveLength(2);
    expect(r.veg).toHaveLength(1);
  });

  test('groups numbers by value', () => {
    const items = [{ n: 1 }, { n: 2 }, { n: 1 }];
    const r = groupby(items, 'n');
    expect(r['1']).toHaveLength(2);
    expect(r['2']).toHaveLength(1);
  });
});

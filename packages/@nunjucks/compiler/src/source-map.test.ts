import { describe, test, expect } from 'bun:test';
import { createSourceMap } from './source-map.ts';

describe('createSourceMap', () => {
  test('stores template name', () => {
    const sm = createSourceMap('foo.njk');
    expect(sm.templateName).toBe('foo.njk');
  });

  test('supports null template name', () => {
    const sm = createSourceMap(null);
    expect(sm.templateName).toBeNull();
  });

  test('starts with empty mappings', () => {
    const sm = createSourceMap('foo.njk');
    expect(sm.mappings).toEqual([]);
  });

  test('templateName is readonly', () => {
    const sm = createSourceMap('foo.njk');
    expect(() => {
      (sm as { templateName: string }).templateName = 'bar';
    }).toThrow();
  });
});

describe('addMapping', () => {
  test('appends a mapping with default column', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    expect(sm.mappings).toEqual([{ compiledLine: 1, originalLine: 10, originalCol: 0 }]);
  });

  test('uses provided column', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10, 5);
    expect(sm.mappings[0]!.originalCol).toBe(5);
  });

  test('appends multiple mappings in order', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    sm.addMapping(5, 20, 3);
    expect(sm.mappings).toHaveLength(2);
    expect(sm.mappings[1]).toEqual({ compiledLine: 5, originalLine: 20, originalCol: 3 });
  });
});

describe('getOriginalPosition', () => {
  test('returns zero position for compiledLine of 0', () => {
    const sm = createSourceMap('foo.njk');
    expect(sm.getOriginalPosition(0)).toEqual({ line: 0, col: 0, name: 'foo.njk' });
  });

  test('returns zero position for negative compiledLine', () => {
    const sm = createSourceMap('foo.njk');
    expect(sm.getOriginalPosition(-5)).toEqual({ line: 0, col: 0, name: 'foo.njk' });
  });

  test('falls back to compiledLine - 1 on empty map', () => {
    const sm = createSourceMap(null);
    expect(sm.getOriginalPosition(3)).toEqual({ line: 2, col: 0, name: null });
  });

  test('falls back to compiledLine - 1 when no mapping matches', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(5, 20);
    expect(sm.getOriginalPosition(3)).toEqual({ line: 2, col: 0, name: 'foo.njk' });
  });

  test('returns exact single mapping', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10, 5);
    expect(sm.getOriginalPosition(1)).toEqual({ line: 10, col: 5, name: 'foo.njk' });
  });

  test('applies offset from the mapping', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    expect(sm.getOriginalPosition(3)).toEqual({ line: 12, col: 0, name: 'foo.njk' });
  });

  test('picks the latest applicable mapping', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    sm.addMapping(5, 20, 2);
    expect(sm.getOriginalPosition(6)).toEqual({ line: 21, col: 2, name: 'foo.njk' });
  });

  test('falls back to earlier mapping when between mappings', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    sm.addMapping(5, 20);
    expect(sm.getOriginalPosition(3)).toEqual({ line: 12, col: 0, name: 'foo.njk' });
  });

  test('returns name equal to templateName', () => {
    const sm = createSourceMap('bar.njk');
    sm.addMapping(1, 10);
    expect(sm.getOriginalPosition(1).name).toBe('bar.njk');
  });
});

describe('SourceMap mappings setter', () => {
  test('can replace mappings', () => {
    const sm = createSourceMap('foo.njk');
    sm.addMapping(1, 10);
    sm.mappings = [{ compiledLine: 2, originalLine: 20, originalCol: 1 }];
    expect(sm.mappings).toEqual([{ compiledLine: 2, originalLine: 20, originalCol: 1 }]);
  });

  test('replaced mappings are used by getOriginalPosition', () => {
    const sm = createSourceMap('foo.njk');
    sm.mappings = [{ compiledLine: 2, originalLine: 20, originalCol: 1 }];
    expect(sm.getOriginalPosition(2)).toEqual({ line: 20, col: 1, name: 'foo.njk' });
  });
});

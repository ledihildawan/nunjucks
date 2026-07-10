import { expect, describe, test } from 'bun:test';
import { SourceMap, applySourceMapToError, createMappedError } from './source-map.js';

describe('SourceMap', () => {
  test('creates with template name', () => {
    const sm = new SourceMap('test.njk');
    expect(sm.templateName).toBe('test.njk');
    expect(sm.mappings).toEqual([]);
  });

  test('addMapping stores mapping', () => {
    const sm = new SourceMap('t.njk');
    sm.addMapping(5, 3, 7);
    expect(sm.mappings).toEqual([{ compiledLine: 5, originalLine: 3, originalCol: 7 }]);
  });

  test('getOriginalPosition returns start for line 0', () => {
    const sm = new SourceMap('t.njk');
    expect(sm.getOriginalPosition(0)).toEqual({ line: 1, col: 0, name: 't.njk' });
  });

  test('getOriginalPosition returns line+offset for negative', () => {
    const sm = new SourceMap('t.njk');
    expect(sm.getOriginalPosition(-5)).toEqual({ line: 1, col: 0, name: 't.njk' });
  });

  test('getOriginalPosition maps through stored mappings', () => {
    const sm = new SourceMap('t.njk');
    sm.addMapping(10, 5, 3);
    const pos = sm.getOriginalPosition(12);
    expect(pos.line).toBe(7);
    expect(pos.col).toBe(3);
    expect(pos.name).toBe('t.njk');
  });

  test('getOriginalPosition returns compiled line if no mapping covers it', () => {
    const sm = new SourceMap('t.njk');
    expect(sm.getOriginalPosition(42).line).toBe(42);
  });

  test('getOriginalPosition returns last mapping for lower line', () => {
    const sm = new SourceMap('t.njk');
    sm.addMapping(20, 10, 0);
    expect(sm.getOriginalPosition(5).line).toBe(5);
  });

  test('fromArray creates SourceMap with pre-filled mappings', () => {
    const sm = SourceMap.fromArray('t.njk', [{ compiledLine: 1, originalLine: 1, originalCol: 0 }]);
    expect(sm.mappings).toHaveLength(1);
  });

  test('fromArray handles non-array input', () => {
    const sm = SourceMap.fromArray('t.njk', null);
    expect(sm.mappings).toEqual([]);
  });
});

describe('applySourceMapToError', () => {
  test('returns null for missing source map data', () => {
    expect(applySourceMapToError({}, 5, null, 't.njk')).toBeNull();
  });

  test('returns null for non-array source map data', () => {
    expect(applySourceMapToError({}, 5, 'not-array', 't.njk')).toBeNull();
  });

  test('sets lineno and colno on error', () => {
    const err = {};
    const smData = [{ compiledLine: 10, originalLine: 3, originalCol: 5 }];
    const result = applySourceMapToError(err, 10, smData, 't.njk');
    expect(result.lineno).toBe(3);
    expect(result.colno).toBe(5);
  });
});

describe('createMappedError', () => {
  test('returns null for missing source map data', () => {
    expect(createMappedError({}, null, 5, 0, 't.njk')).toBeNull();
  });

  test('creates error with mapped location', () => {
    const err = new Error('test error');
    const smData = [{ compiledLine: 10, originalLine: 3, originalCol: 7 }];
    const mapped = createMappedError(err, smData, 10, 0, 'test.njk');
    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.message).toContain('test.njk');
    expect(mapped.message).toContain('test error');
    expect(mapped.lineno).toBe(3);
  });
});

import { describe, test, expect } from 'bun:test';
import { templateNameStr } from './emitters.js';

describe('templateNameStr', () => {
  test('stringifies template name', () => {
    expect(templateNameStr({ templateName: 'foo' })).toBe('"foo"');
  });

  test('returns undefined for null name', () => {
    expect(templateNameStr({ templateName: null })).toBe('undefined');
  });
});

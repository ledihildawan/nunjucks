import { describe, test, expect } from 'bun:test';
import { createErrorDefinition } from './factory.ts';

const baseOpts = { name: 'TEST_ERROR', category: 'test', causes: [] };

describe('createErrorDefinition', () => {
  test('sets subjectFrom when message contains {name}', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'Cannot find {name}' });
    expect(def.subjectFrom).not.toBeNull();
  });

  test('subjectFrom is null when no placeholders', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'Something went wrong' });
    expect(def.subjectFrom).toBeNull();
  });

  test('pattern matches the literal message case-insensitively', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'Cannot find {name}' });
    expect(def.pattern.test('cannot find foo')).toBe(true);
    expect(def.pattern.test('cannot find FOO')).toBe(true);
    expect(def.pattern.test('different message')).toBe(false);
  });

  test('escapes regex metacharacters in message', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'Error [code]' });
    expect(def.pattern.test('Error [code]')).toBe(true);
  });

  test('titleTemplate equals message', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'My error' });
    expect(def.titleTemplate).toBe('My error');
  });

  test('severity propagates', () => {
    const def = createErrorDefinition({ ...baseOpts, message: 'warn', severity: 'warning' });
    expect(def.severity).toBe('warning');
  });
});

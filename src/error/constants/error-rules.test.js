import { describe, test, expect } from 'bun:test';
import { ERROR_RULES, DEFAULT_CLASSIFICATION } from './error-rules.js';

describe('ERROR_RULES', () => {
  test('has expected number of rules', () => {
    expect(ERROR_RULES).toHaveLength(15);
  });

  test('each rule has pattern, category, causes, fixCode, fixComment', () => {
    for (const rule of ERROR_RULES) {
      expect(rule).toHaveProperty('pattern');
      expect(rule).toHaveProperty('category');
      expect(rule).toHaveProperty('causes');
      expect(Array.isArray(rule.causes)).toBe(true);
      expect(rule).toHaveProperty('fixCode');
      expect(rule).toHaveProperty('fixComment');
    }
  });

  test('rules have unique categories', () => {
    const categories = ERROR_RULES.map(r => r.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  test('first rule is undefined_value (nested property access)', () => {
    expect(ERROR_RULES[0].category).toBe('undefined_value');
    expect(ERROR_RULES[0].subjectFrom).toBe('undefinedName');
  });

  test('last rule is filesystem_error', () => {
    const last = ERROR_RULES[ERROR_RULES.length - 1];
    expect(last.category).toBe('filesystem_error');
  });

  test.each(ERROR_RULES.filter(r => r.subjectFrom === 'undefinedName'))(
    '$category has undefinedName subject',
    (rule) => {
      expect(rule.subjectFrom).toBe('undefinedName');
    },
  );

  test.each(ERROR_RULES.filter(r => r.subjectFrom === null))(
    '$category has null subject',
    (rule) => {
      expect(rule.subjectFrom).toBeNull();
    },
  );
});

describe('DEFAULT_CLASSIFICATION', () => {
  test('has expected structure', () => {
    expect(DEFAULT_CLASSIFICATION.category).toBe('unknown');
    expect(DEFAULT_CLASSIFICATION.undefinedName).toBeNull();
    expect(Array.isArray(DEFAULT_CLASSIFICATION.causes)).toBe(true);
    expect(typeof DEFAULT_CLASSIFICATION.fixCode).toBe('string');
    expect(typeof DEFAULT_CLASSIFICATION.fixComment).toBe('string');
  });
});

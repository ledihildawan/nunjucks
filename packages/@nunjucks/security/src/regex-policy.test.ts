import { describe, expect, test } from 'bun:test';
import { isDangerousRegexPattern } from './regex-policy.ts';

describe('isDangerousRegexPattern', () => {
  describe('rejects nested quantifiers and quantified ambiguous alternations', () => {
    test.each([
      ['(a+)+'],
      ['(a+)*'],
      ['(a*)*'],
      ['(a*)+'],
      ['(a+)?'],
      ['(a?)+'],
      ['^(\\d+\\s*)+$'],
      ['(a+b)+'],
      ['(a{1,3})+'],
      ['(\\w+):\\/\\/(\\w+\\.)+[a-z]{2,}'],
      ['(?:a+)+'],
      ['(?<word>a+)+'],
      ['(a|a)+'],
      ['(a|aa)+'],
      ['(?:a|aa)+'],
      // WHY: fail-closed false positive — disjoint single-char branches are linear,
      // but indistinguishable from `(a|a)+` without automata analysis.
      ['(a|b)+'],
      ['[()]*(a|b)?c+'],
    ])('%s', (pattern) => {
      expect(isDangerousRegexPattern(pattern)).toBe(true);
    });
  });

  describe('allows linear patterns', () => {
    test.each([
      [''],
      ['abc'],
      ['a+'],
      ['a*b*c?'],
      ['(a+)b'],
      ['(ab)+'],
      ['(?:ab)+'],
      ['(a{2})+'],
      ['[a+]+'],
      ['[^)]*\\)[+*?]?'],
      ['a{2}'],
      ['a{2,4}'],
      ['(a{2}){3}'],
      ['\\(a+\\)+'],
      ['x(?=a+)y+'],
      ['\\d{3}-\\d{4}'],
      // WHY: alternation alone is fine — only a quantifier over the ambiguous group flags.
      ['(abc|def)'],
      ['(a|b)'],
      ['(a|b)c+'],
      ['(a|b){2}'],
      ['a|b'],
    ])('%s', (pattern) => {
      expect(isDangerousRegexPattern(pattern)).toBe(false);
    });
  });

  test('unbalanced groups do not crash and defer to RegExp validation', () => {
    expect(isDangerousRegexPattern('))a+((')).toBe(false);
    expect(isDangerousRegexPattern('((a+)')).toBe(false);
  });
});

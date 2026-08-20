import { describe, expect, test } from 'bun:test';
import { isDangerousRegexPattern } from './regex-policy.ts';

describe('isDangerousRegexPattern', () => {
  describe('rejects nested quantifiers (star-height >= 1)', () => {
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
      ['(a|b)+'],
      ['(?:ab)+'],
      ['(a{2})+'],
      ['[a+]+'],
      ['[^)]*\\)[+*?]?'],
      ['a{2}'],
      ['a{2,4}'],
      ['(a{2}){3}'],
      ['\\(a+\\)+'],
      ['[()]*(a|b)?c+'],
      ['x(?=a+)y+'],
      ['\\d{3}-\\d{4}'],
    ])('%s', (pattern) => {
      expect(isDangerousRegexPattern(pattern)).toBe(false);
    });
  });

  test('unbalanced groups do not crash and defer to RegExp validation', () => {
    expect(isDangerousRegexPattern('))a+((')).toBe(false);
    expect(isDangerousRegexPattern('((a+)')).toBe(false);
  });

  // WHY: scope boundary, documented — ambiguous ALTERNATION like `(a|aa)+` is also
  // exponential but is not a nested-quantifier shape; detecting it requires automata
  // analysis, which is beyond this structural guard. Template regexes remain capped
  // in length (parser + `is matches`) as the second line of defense.
  test('ambiguous alternation is out of scope for the structural scan', () => {
    expect(isDangerousRegexPattern('(a|aa)+')).toBe(false);
  });
});

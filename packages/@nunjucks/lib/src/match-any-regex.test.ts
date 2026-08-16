import { describe, test, expect } from 'bun:test';
import { MATCH_ANY_RE } from './match-any-regex.ts';

describe('MATCH_ANY_RE', () => {
  test('matches any single character', () => {
    expect(MATCH_ANY_RE.test('a')).toBe(true);
    expect(MATCH_ANY_RE.test('Z')).toBe(true);
    expect(MATCH_ANY_RE.test('9')).toBe(true);
    expect(MATCH_ANY_RE.test('é')).toBe(true);
  });

  test('matches anywhere within a longer string', () => {
    expect(MATCH_ANY_RE.test('nunjucks')).toBe(true);
  });

  test('does not match an empty string', () => {
    expect(MATCH_ANY_RE.test('')).toBe(false);
  });

  test('does not match a lone line terminator', () => {
    expect(MATCH_ANY_RE.test('\n')).toBe(false);
  });
});

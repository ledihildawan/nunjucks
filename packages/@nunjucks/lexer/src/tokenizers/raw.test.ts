import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeRaw } from './raw.ts';

const run = (src: string) => tokenizeRaw(createState(src));

describe('tokenizeRaw', () => {
  test('returns null for non-block-start', () => {
    expect(run('hello')).toBeNull();
  });

  test('returns null for non-raw block tag', () => {
    expect(run('{% if true %}')).toBeNull();
  });

  test('raw block', () => {
    const r = run('{% raw %}{{ x }}{% endraw %}');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toContain('{{ x }}');
  });

  test('verbatim block', () => {
    const r = run('{% verbatim %}{{ y }}{% endverbatim %}');
    expect(r?.token.type).toBe('raw');
  });

  test('nested raw blocks increment depth', () => {
    const r = run('{% raw %}{% raw %}{% endraw %}{% endraw %}');
    expect(r?.token.type).toBe('raw');
  });

  test('mismatched end tag does not terminate', () => {
    const r = run('{% raw %}text{% endverbatim %}more{% endraw %}');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toContain('endverbatim');
  });
});

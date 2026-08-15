import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeRaw } from './raw.ts';

const run = (src: string, offset = 0) => tokenizeRaw(createState(src.slice(offset)));

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
    expect(r?.token.value).toBe('{% raw %}{{ x }}{% endraw %}');
  });

  test('verbatim block', () => {
    const r = run('{% verbatim %}{{ y }}{% endverbatim %}');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toBe('{% verbatim %}{{ y }}{% endverbatim %}');
  });

  test('nested raw blocks increment depth', () => {
    const r = run('{% raw %}{% raw %}{% endraw %}{% endraw %}');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toBe('{% raw %}{% raw %}{% endraw %}{% endraw %}');
  });

  test('mismatched end tag does not terminate', () => {
    const r = run('{% raw %}text{% endverbatim %}more{% endraw %}');
    expect(r?.token.type).toBe('raw');
    expect(String(r?.token.value)).toContain('endverbatim');
    expect(String(r?.token.value).endsWith('{% endraw %}')).toBe(true);
  });

  test('terminates at endraw with trailing template content left unlexed', () => {
    const r = run('{% raw %}{{ x }}{% endraw %}tail');
    expect(r?.token.value).toBe('{% raw %}{{ x }}{% endraw %}');
    expect(r?.state.index).toBe('{% raw %}{{ x }}{% endraw %}'.length);
  });

  test('nested endraw closes only the inner block, outer survives', () => {
    const src = '{% raw %}a{% raw %}b{% endraw %}c{% endraw %}tail';
    const r = run(src);
    expect(r?.token.value).toBe('{% raw %}a{% raw %}b{% endraw %}c{% endraw %}');
    expect(r?.state.index).toBe(src.length - 'tail'.length);
  });

  test('unterminated raw block runs to end of input', () => {
    const r = run('{% raw %}no close here');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toContain('no close here');
    expect(r?.state.index).toBe('{% raw %}no close here'.length);
  });
});

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

describe('tokenizeRaw strip variants', () => {
  test('{%- raw %} flags stripLeft', () => {
    const r = run('{%- raw %}{{ x }}{% endraw %}');
    expect(r?.token.type).toBe('raw');
    expect(r?.token.value).toBe('{%- raw %}{{ x }}{% endraw %}');
    expect(r?.token.stripLeft).toBe(true);
    expect(r?.token.stripRight).toBeUndefined();
  });

  test('{% raw -%} is recognized and keeps full tag text', () => {
    const r = run('{% raw -%}{{ x }}{% endraw %}');
    expect(r?.token.value).toBe('{% raw -%}{{ x }}{% endraw %}');
    expect(r?.token.stripLeft).toBeUndefined();
  });

  test('{% endraw -%} flags stripRight', () => {
    const r = run('{% raw %}{{ x }}{% endraw -%}');
    expect(r?.token.value).toBe('{% raw %}{{ x }}{% endraw -%}');
    expect(r?.token.stripRight).toBe(true);
  });

  test('{%- endraw %} terminates the block', () => {
    const src = '{% raw %}a{%- endraw %}tail';
    const r = run(src);
    expect(r?.token.value).toBe('{% raw %}a{%- endraw %}');
    expect(r?.state.index).toBe(src.length - 'tail'.length);
  });

  test('{%- raw -%} combined with {%- endraw -%} tracks depth', () => {
    const src = '{%- raw -%}a{%- raw -%}b{% endraw %}c{% endraw -%}';
    const r = run(src);
    expect(r?.token.value).toBe(src);
    expect(r?.token.stripLeft).toBe(true);
    expect(r?.token.stripRight).toBe(true);
    expect(r?.state.index).toBe(src.length);
  });

  test('recognizes raw blocks written with custom block delimiters', () => {
    const r = tokenizeRaw(
      createState('<< raw >>a<< endraw >>', {
        tags: { blockStart: '<<', blockEnd: '>>' },
      })
    );
    expect(r?.token.value).toBe('<< raw >>a<< endraw >>');
    expect(r?.state.index).toBe('<< raw >>a<< endraw >>'.length);
  });
});

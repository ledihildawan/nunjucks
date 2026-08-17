import { describe, expect, test } from 'bun:test';
import { isTemplateError } from '@nunjucks/error-formatter';
import { isErr, isOk, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { parse } from './index.ts';

// WHY: deterministic seeded PRNG (numerical-recurrence LCG) — the corpus is identical
// on every run/CI machine, so a failure always reproduces from the printed seed+case.
const createSeededRandom = (seedValue: number) => {
  let state = seedValue >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const GRAMMAR_FRAGMENTS: readonly string[] = [
  '{{ x }}',
  '{{ a.b.c }}',
  '{{ 1 + 2 * 3 }}',
  '{{ x |> upper }}',
  '{{ x := 5 }}',
  '{{ cond ? a : b }}',
  '{{ [1, 2, 3][0:2:1] }}',
  '{{ {k: v} }}',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: nunjucks template-literal fragment — ${} here is corpus data, not a JS interpolation.
  '{{ `tpl ${name}` }}',
  '{% if x %}A{% elif y %}B{% else %}C{% endif %}',
  '{% for item in items %}{{ item }}{% endfor %}',
  '{% for k, v in obj %}{% endfor %}',
  '{% block content %}body{% endblock %}',
  '{% extends "base.njk" %}',
  '{% include "part.njk" ignore missing %}',
  '{% component card(title) %}{{ children }}{% endcomponent %}',
  '{% render card() %}x{% endrender %}',
  '{% slot header %}h{% endslot %}',
  '{% switch x %}{% case 1 %}one{% default %}d{% endswitch %}',
  '{% match x %}{% when "a" if y %}A{% endmatch %}',
  '{% scope a = 1, b = 2 %}{{ a + b }}{% endscope %}',
  '{% exec obj.push(1) %}',
  '{% capture box %}{{ x }}{% endcapture %}',
  '{% raw %}{{ not parsed }}{% endraw %}',
  '{# comment #}',
  '{#- stripped -#}',
  '{{- x -}}',
  '{%- if x -%}y{%- endif -%}',
  // deliberately malformed fragments (lexer/parser edge feeders)
  '{{',
  '{%',
  '{#',
  '}}',
  '%}',
  '{{ a ? b }}',
  '{% if %}',
  '{% endif %}',
  '{% for %}{% endfor %}',
  '{% block %}',
  '{{ /re/u }}',
  '{{ x[1:2:0] }}',
  '{% extends %}',
  '{% from "t" import _hidden %}',
  '{% raw %}',
  '{{ `unterminated }}',
  '{{ "unterminated }}',
  '{{ x.constructor.constructor }}',
  '{{ __proto__.polluted }}',
];

// biome-ignore lint/suspicious/noTemplateCurlyInString: fuzz alphabet — ${} is corpus data, not a JS interpolation.
const GARBAGE_CHARS = '{}%#<>"\'`\\${}[]().,:;=+-*/|!?& \t\nabcXYZ019\u00e9\u4e2d';

const buildRandomTemplate = (random: () => number): string => {
  const parts: string[] = [];
  const count = 1 + Math.floor(random() * 12);
  for (let i = 0; i < count; i += 1) {
    if (random() < 0.75) {
      const fragment = GRAMMAR_FRAGMENTS[Math.floor(random() * GRAMMAR_FRAGMENTS.length)];
      if (fragment !== undefined) {
        parts.push(fragment);
      }
    } else {
      const garbageLength = 1 + Math.floor(random() * 8);
      let garbage = '';
      for (let j = 0; j < garbageLength; j += 1) {
        garbage += GARBAGE_CHARS[Math.floor(random() * GARBAGE_CHARS.length)] ?? 'x';
      }
      parts.push(garbage);
    }
  }
  return parts.join('');
};

describe('parser fuzz (deterministic corpus)', () => {
  // WHY: 300 seeded cases per run — corpus diversity without flaky runtime growth.
  // The invariant under test: parse NEVER leaks a non-TemplateError throw (a raw
  // RangeError/TypeError here means an input class escaped the Result boundary).
  test.each(Array.from({ length: 300 }, (_, i) => i))('case %i parses to Result', (caseIndex) => {
    const random = createSeededRandom(0x5eed_0000 + caseIndex);
    let outcome: Result<Node | null, unknown> | null = null;
    let leaked: unknown = null;
    try {
      let template = '';
      // a few variants per case for corpus breadth
      for (let variant = 0; variant < 3; variant += 1) {
        template += buildRandomTemplate(random);
      }
      outcome = parse(template);
    } catch (error) {
      leaked = error;
    }
    expect(leaked, `case ${caseIndex} leaked a raw throw`).toBeNull();
    expect(outcome).not.toBeNull();
    if (outcome !== null && isErr(outcome)) {
      expect(
        isTemplateError(outcome.error),
        `case ${caseIndex} errored with a non-TemplateError: ${String(outcome.error)}`
      ).toBe(true);
    }
  });

  test('corpus sanity: both ok and error outcomes occur', () => {
    let okCount = 0;
    let errCount = 0;
    for (let caseIndex = 0; caseIndex < 300; caseIndex += 1) {
      const random = createSeededRandom(0x5eed_0000 + caseIndex);
      let template = '';
      for (let variant = 0; variant < 3; variant += 1) {
        template += buildRandomTemplate(random);
      }
      const outcome = parse(template);
      if (isOk(outcome)) {
        okCount += 1;
      } else {
        errCount += 1;
      }
    }
    // WHY: a corpus that only ever errors exercises nothing — pin that the grammar
    // fragments really do parse and the malformed ones really do fail.
    expect(okCount).toBeGreaterThan(20);
    expect(errCount).toBeGreaterThan(20);
  });
});

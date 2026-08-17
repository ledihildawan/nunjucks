import { describe, expect, test } from 'bun:test';
import { isErr, isOk, type Result } from '@nunjucks/lib';
import { compileToCode } from './compile-pipeline.ts';

// WHY: deterministic seeded PRNG — identical corpus on every machine; failures
// reproduce from the printed case index (same contract as parser/fuzz.test.ts).
const createSeededRandom = (seedValue: number) => {
  let state = seedValue >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const EXPRESSIONS: readonly string[] = [
  'x',
  'a.b.c',
  'a?.b?.c',
  'a?.()',
  '1 + 2 * 3',
  '(1 + 2) * 3',
  'x |> upper',
  'x |> f(1, 2) |> g()',
  'x := 5',
  '(x := 5)',
  '[a, b] := pair',
  '{k} := obj',
  'a ? b : c',
  'cond ? x |> upper : y',
  '[1, 2, 3]',
  '[1, 2, 3][0]',
  '[1, 2, 3][0:2]',
  '[1, 2, 3][::2]',
  '[1, 2, 3][::-1]',
  '{k: v}',
  'obj.k',
  'obj["k"]',
  'obj[k]',
  '1..5',
  'a..b',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: nunjucks template-literal fragment — corpus data, not a JS interpolation.
  '`tpl ${name}`',
  '"str"',
  "'str'",
  '/re/u',
  'not x',
  '!x',
  'a and b',
  'a or b',
  'a ?? b',
  'a in b',
  'a is defined',
  'a is not odd',
  'x is between(1, 5)',
  'super()',
  'a | b',
  'a & b',
  'a << 2',
  '~a',
  '-x',
  '+x',
  'x++',
  '--y',
  'a == b',
  'a === b',
  'a < b < c',
  'missing.deep.chains.here',
];

const STATEMENTS: readonly string[] = [
  '{% if x %}A{% elif y %}B{% else %}C{% endif %}',
  '{% for item in items %}{{ item }}{% else %}empty{% endfor %}',
  '{% for k, v in obj %}{% endfor %}',
  '{% for [a, b] in pairs %}{% endfor %}',
  '{% for {name} in users %}{% endfor %}',
  '{% block content %}b{% endblock %}',
  '{% extends "base.njk" %}',
  '{% include "part.njk" ignore missing %}',
  '{% include "part.njk" with {v: 1} only %}',
  '{% component card(title) %}{{ children }}{% endcomponent %}',
  '{% render card() %}body{% endrender %}',
  '{% render card("T", cls="k") %}{% slot h %}x{% endslot %}{% endrender %}',
  '{% switch x %}{% case 1 %}one{% default %}d{% endswitch %}',
  '{% match x %}{% when "a" if y %}A{% endmatch %}',
  '{% scope a = 1, b = 2 %}{{ a + b }}{% endscope %}',
  '{% scope %}{% endscope %}',
  '{% exec obj.push(1) %}',
  '{% capture box %}{{ x }}{% endcapture %}{{ box }}',
  '{% raw %}{{ literal }}{% endraw %}',
  '{% filter upper %}text{% endfilter %}',
  '{% import "lib.njk" as lib %}',
  '{% from "lib.njk" import a, b as c with context %}',
  '{% set_like_thing %}',
];

// biome-ignore lint/suspicious/noTemplateCurlyInString: fuzz alphabet — ${} is corpus data, not a JS interpolation.
const GARBAGE = '{}%#<>"\'`\\${}[]().,:;=+-*/|!?& \n';

const pickFrom = <T>(random: () => number, items: readonly T[]): T | undefined =>
  items[Math.floor(random() * items.length)];

const buildGarbageRun = (random: () => number): string => {
  const garbageLength = 1 + Math.floor(random() * 6);
  let garbage = '';
  for (let j = 0; j < garbageLength; j += 1) {
    garbage += GARBAGE[Math.floor(random() * GARBAGE.length)] ?? 'x';
  }
  return garbage;
};

const buildTemplate = (random: () => number): string => {
  const parts: string[] = [];
  const count = 1 + Math.floor(random() * 10);
  for (let i = 0; i < count; i += 1) {
    const roll = random();
    if (roll < 0.4) {
      const expr = pickFrom(random, EXPRESSIONS);
      if (expr !== undefined) {
        parts.push(`{{ ${expr} }}`);
      }
    } else if (roll < 0.8) {
      const stmt = pickFrom(random, STATEMENTS);
      if (stmt !== undefined) {
        parts.push(stmt);
      }
    } else {
      parts.push(buildGarbageRun(random));
    }
  }
  return parts.join('\n');
};

describe('compiler fuzz (deterministic corpus)', () => {
  // WHY: the invariant under test is compileToCode's Result boundary — valid or
  // catalogued error, NEVER a raw non-Error throw (a leaked RangeError/TypeError
  // means an input class escaped the boundary). 250 seeded cases x 2 variants.
  test.each(Array.from({ length: 250 }, (_, i) => i))('case %i compiles to Result', (caseIndex) => {
    const random = createSeededRandom(0xc0ff_ee00 + caseIndex);
    const source = `${buildTemplate(random)}\n${buildTemplate(random)}`;
    let outcome: Result<string, Error> | null = null;
    let leaked: unknown = null;
    try {
      outcome = compileToCode({ source, templateName: 'fuzz.njk', undefinedMode: 'chainable' });
    } catch (error) {
      leaked = error;
    }
    expect(leaked, `case ${caseIndex} leaked a raw throw`).toBeNull();
    expect(outcome).not.toBeNull();
    // WHY: when compilation succeeds, the emitted code must be VALID generated JS —
    // loadCompiledCode would throw a SyntaxError otherwise at render time, far from
    // the compile site. Compile-then-syntax-check keeps that failure at the boundary.
    if (outcome !== null && isOk(outcome)) {
      expect(typeof outcome.value).toBe('string');
      expect(outcome.value.length).toBeGreaterThan(0);
      expect(outcome.value).toContain('async function* root');
    }
  });

  test('corpus sanity: both ok and error outcomes occur', () => {
    let okCount = 0;
    let errCount = 0;
    for (let caseIndex = 0; caseIndex < 250; caseIndex += 1) {
      const random = createSeededRandom(0xc0ff_ee00 + caseIndex);
      const source = `${buildTemplate(random)}\n${buildTemplate(random)}`;
      const outcome = compileToCode({
        source,
        templateName: 'fuzz.njk',
        undefinedMode: 'chainable',
      });
      if (isOk(outcome)) {
        okCount += 1;
      } else if (isErr(outcome)) {
        errCount += 1;
      }
    }
    expect(okCount).toBeGreaterThan(30);
    expect(errCount).toBeGreaterThan(30);
  });
});

import { describe, expect, test } from 'bun:test';
import { literal, match, output, symbol, templateData, when } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileMatch, compileWhen } from './match.ts';
import { makeFailingStatementCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileMatch', () => {
  test('literal pattern emits strict equality', () => {
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: literal(ZERO_LOC, 'a'),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('=== "a"');
    expect(joined).toContain('t_2 = false');
    expect(joined).toContain('!t_2');
  });

  test('symbol pattern binds the target (unless wildcard _)', () => {
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: symbol(ZERO_LOC, '_'),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'any')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).not.toContain('frame.set("_"');
  });

  test('emits default fallback when not matched', () => {
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [],
      default: output(ZERO_LOC, [templateData(ZERO_LOC, 'd')]),
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('if (!');
  });

  test('symbol arms bind lazily — only the arm being considered binds', () => {
    // WHY: regression (MED-2) — bindings used to be emitted before the arm
    // condition, so `{% match 5 %}{% when a %}A{% when b %}B{% endmatch %}`
    // bound BOTH a and b; each binding must sit inside its own arm's `if`.
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: symbol(ZERO_LOC, 'a'),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'A')]),
        }),
        when(ZERO_LOC, {
          pattern: symbol(ZERO_LOC, 'b'),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'B')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    const lines = c.emitted
      .join('')
      .split('\n')
      .filter((line) => line.length > 0);
    const bindA = lines.findIndex((line) => line.includes('name: "a"'));
    const bindB = lines.findIndex((line) => line.includes('name: "b"'));
    expect(lines[bindA - 1]).toBe('if (!t_2) {');
    expect(lines[bindB - 1]).toBe('if (!t_2) {');
  });

  test('guards evaluate inside their arm — no side effects after a match', () => {
    // WHY: regression (MED-2) — guards used to be evaluated before the arm
    // condition, so a walrus in a later arm's guard fired even after an
    // earlier arm had matched; the guard must be emitted strictly inside the
    // matched-flag-guarded arm block.
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: literal(ZERO_LOC, 5),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'A')]),
        }),
        when(ZERO_LOC, {
          pattern: literal(ZERO_LOC, 7),
          guard: { marker: 'GUARD' } as never,
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'B')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    const armOpen = joined.indexOf('if (!t_2 && (t_1 === 7)) {');
    const guardPos = joined.indexOf('GUARD');
    expect(armOpen).toBeGreaterThan(-1);
    expect(guardPos).toBeGreaterThan(armOpen);
    expect(joined).toContain(
      'if (!t_2 && (t_1 === 7)) {\nlet t_3 = \nGUARD;\nif (t_3) {\nt_2 = true;\n'
    );
  });

  test('NaN literal pattern compares via self-inequality, never === null', () => {
    // WHY: JSON.stringify(NaN) is "null" — a `=== null` arm can never match
    // NaN; the literal factory accepts NaN values even though the lexer
    // cannot produce them, so emission must stay NaN-safe.
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: literal(ZERO_LOC, Number.NaN),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'nan')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('if (!t_2 && (t_1 !== t_1)) {');
    expect(joined).not.toContain('=== null');
  });

  test('Infinity literal patterns compare against the Infinity literal', () => {
    const c = makeFailingStatementCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [
        when(ZERO_LOC, {
          pattern: literal(ZERO_LOC, Number.POSITIVE_INFINITY),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'inf')]),
        }),
      ],
      default: null,
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('if (!t_2 && (t_1 === Infinity)) {');
  });
});

describe('compileWhen', () => {
  test('fails because WhenNode should be handled by compileMatch', () => {
    const c = makeFailingStatementCompiler();
    expect(() => compileWhen(asCompiler(c), { node: {} as never, frame })).toThrow(/WhenNode/);
  });
});

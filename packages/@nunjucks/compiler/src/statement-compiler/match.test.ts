import { describe, expect, test } from 'bun:test';
import { literal, match, output, symbol, templateData, when } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileMatch, compileWhen } from './match.ts';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
    compile: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'X');
    },
    compileExpression: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'E');
    },
    fail: (msg: string) => {
      throw new Error(msg);
    },
  };
};

describe('compileMatch', () => {
  test('literal pattern emits strict equality', () => {
    const c = makeCompiler();
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
    const c = makeCompiler();
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
    const c = makeCompiler();
    const node = match(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'v'),
      cases: [],
      default: output(ZERO_LOC, [templateData(ZERO_LOC, 'd')]),
    });
    compileMatch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('if (!');
  });
});

describe('compileWhen', () => {
  test('fails because WhenNode should be handled by compileMatch', () => {
    const c = makeCompiler();
    expect(() => compileWhen(asCompiler(c), { node: {} as never, frame })).toThrow(/WhenNode/);
  });
});

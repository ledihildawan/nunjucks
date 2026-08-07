import { describe, test, expect } from 'bun:test';
import { compileMatch, compileWhen } from './match.ts';
import { symbol, literal, output, templateData, when, match } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'E'); },
    fail: (msg: string) => { throw new Error(msg); },
  };
};

describe('compileMatch', () => {
  test('literal pattern emits strict equality', () => {
    const c = makeCompiler();
    const node = match(0, 0, {
      expr: symbol(0, 0, 'v'),
      cases: [when(0, 0, literal(0, 0, 'a'), output(0, 0, [templateData(0, 0, 'one')]))],
      default: null,
    });
    compileMatch(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('=== "a"');
    expect(joined).toContain('t_2 = false');
    expect(joined).toContain('!t_2');
  });

  test('symbol pattern binds the target (unless wildcard _)', () => {
    const c = makeCompiler();
    const node = match(0, 0, {
      expr: symbol(0, 0, 'v'),
      cases: [when(0, 0, symbol(0, 0, '_'), output(0, 0, [templateData(0, 0, 'any')]))],
      default: null,
    });
    compileMatch(asCompiler(c), node as never, frame);
    expect(c.emitted.join('')).not.toContain('frame.set("_"');
  });

  test('emits default fallback when not matched', () => {
    const c = makeCompiler();
    const node = match(0, 0, {
      expr: symbol(0, 0, 'v'),
      cases: [],
      default: output(0, 0, [templateData(0, 0, 'd')]),
    });
    compileMatch(asCompiler(c), node as never, frame);
    expect(c.emitted.join('')).toContain('if (!');
  });
});

describe('compileWhen', () => {
  test('fails because WhenNode should be handled by compileMatch', () => {
    const c = makeCompiler();
    expect(() => compileWhen(asCompiler(c), {} as never, frame)).toThrow(/WhenNode/);
  });
});
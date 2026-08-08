import { describe, test, expect } from 'bun:test';
import { compileDestructuring } from './pattern.ts';
import { arrayPattern, objectPattern, assignmentPattern, restPattern } from '@nunjucks/nodes';
import { symbol, literal, pair } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';

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

const destructure = (pattern: Node, source: string, registerFrame = true) => {
  const compiler = makeCompiler();
  const frame = createFrame();
  compileDestructuring({ ctx: asCompiler(compiler), frame, registerFrame }, pattern, source);
  return compiler.emitted.join('');
};

describe('compileDestructuring', () => {
  test('symbol pattern emits a frame binding', () => {
    const out = destructure(symbol(ZERO_LOC, 'a'), 'src');
    expect(out).toContain('frame.set("a"');
    expect(out).toContain('let t_1 = src;');
  });

  test('array pattern emits indexed array lookups per element', () => {
    const pattern = arrayPattern(ZERO_LOC, [symbol(ZERO_LOC, 'a'), symbol(ZERO_LOC, 'b')]);
    const out = destructure(pattern, 'src');
    expect(out).toContain('Array.isArray(src)');
    expect(out).toContain('src[0]');
    expect(out).toContain('src[1]');
  });

  test('array rest pattern emits a slice', () => {
    const pattern = arrayPattern(ZERO_LOC, [restPattern(ZERO_LOC, symbol(ZERO_LOC, 'rest'))]);
    const out = destructure(pattern, 'src');
    expect(out).toContain('src.slice(0)');
  });

  test('assignment pattern emits a default-value binding', () => {
    const pattern = arrayPattern(ZERO_LOC, [
      assignmentPattern(ZERO_LOC, { target: symbol(ZERO_LOC, 'a'), defaultVal: literal(ZERO_LOC, 1) }),
    ]);
    const out = destructure(pattern, 'src');
    expect(out).toContain('=== undefined ?');
  });

  test('object pattern emits safe member lookups for each key', () => {
    const pattern = objectPattern(ZERO_LOC, [
      pair(ZERO_LOC, { key: symbol(ZERO_LOC, 'name'), val: symbol(ZERO_LOC, 'name') }),
    ]);
    const out = destructure(pattern, 'src');
    expect(out).toContain('runtime.optionalMemberLookup(src, "name")');
  });
});

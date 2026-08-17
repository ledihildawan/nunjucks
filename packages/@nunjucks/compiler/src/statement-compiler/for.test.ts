import { describe, expect, test } from 'bun:test';
import type { ForNode } from '@nunjucks/nodes';
import { arrayPattern, forNode, literal, objectPattern, pair, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';
import { compileFor } from './for.ts';
import { makeFullStatementCompiler } from './test-helpers.ts';

const compile = (node: ForNode) => {
  const compiler = makeFullStatementCompiler();
  const frame = createFrame();
  compileFor(compiler as unknown as Compiler, { node, frame });
  return compiler.emitted.join('');
};

describe('compileFor', () => {
  test('simple binding emits loop with frame.set', () => {
    const node = forNode(ZERO_LOC, {
      name: symbol(ZERO_LOC, 'item'),
      arr: literal(ZERO_LOC, []),
      body: symbol(ZERO_LOC, 'body'),
    });
    const out = compile(node);
    expect(out).toContain('frame = frame.push(true)');
    expect(out).toContain('frame = frame.set({ name: "item"');
    expect(out).toContain('frame = frame.pop()');
  });

  test('array binding emits indexed access', () => {
    const node = forNode(ZERO_LOC, {
      name: arrayPattern(ZERO_LOC, [symbol(ZERO_LOC, 'a'), symbol(ZERO_LOC, 'b')]),
      arr: literal(ZERO_LOC, []),
      body: symbol(ZERO_LOC, 'body'),
    });
    const out = compile(node);
    expect(out).toContain('Array.isArray');
    expect(out).toContain('frame = frame.pop()');
  });

  test('object binding emits key/value iteration', () => {
    const node = forNode(ZERO_LOC, {
      name: objectPattern(ZERO_LOC, [
        pair(ZERO_LOC, { key: symbol(ZERO_LOC, 'k'), val: symbol(ZERO_LOC, 'v') }),
      ]),
      arr: literal(ZERO_LOC, {}),
      body: symbol(ZERO_LOC, 'body'),
    });
    const out = compile(node);
    expect(out).toContain('for(');
    expect(out).toContain('frame = frame.pop()');
  });

  test('with alternate emits else block', () => {
    const node = forNode(ZERO_LOC, {
      name: symbol(ZERO_LOC, 'item'),
      arr: literal(ZERO_LOC, []),
      body: symbol(ZERO_LOC, 'body'),
      alternate: symbol(ZERO_LOC, 'else'),
    });
    const out = compile(node);
    expect(out).toContain('if (!');
    expect(out).toContain('frame = frame.pop()');
  });
});

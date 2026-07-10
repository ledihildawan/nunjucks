import { describe, test, expect } from 'bun:test';
import { compileInlineIf } from './inline.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    compile: (node) => emitted.push(node.mock),
  };
};

describe('compileInlineIf', () => {
  test('compiles ternary with else', () => {
    const ctx = makeCtx();
    compileInlineIf(ctx, {
      cond: { mock: 'cond' },
      body: { mock: 'yes' },
      else_: { mock: 'no' },
    });
    expect(ctx.emitted).toEqual(['(', 'cond', '?', 'yes', ':', 'no', ')']);
  });

  test('uses empty string when else_ is null', () => {
    const ctx = makeCtx();
    compileInlineIf(ctx, {
      cond: { mock: 'cond' },
      body: { mock: 'yes' },
      else_: null,
    });
    expect(ctx.emitted).toEqual(['(', 'cond', '?', 'yes', ':', '""', ')']);
  });
});

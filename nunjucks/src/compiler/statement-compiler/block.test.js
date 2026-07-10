import { describe, test, expect } from 'bun:test';
import { compileBlock, compileSuper } from './block.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    buffer: 'output',
    inBlock: false,
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => 't_1',
  };
};

describe('compileBlock', () => {
  test('emits block with parentTemplate guard when not inBlock', () => {
    const ctx = makeCtx();
    const node = { name: { value: 'header' } };
    compileBlock(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('if(!parentTemplate) {');
    expect(code).toContain('context.getBlock("header")');
    expect(code).toContain('output += t_1');
  });

  test('omits parentTemplate guard when inBlock', () => {
    const ctx = makeCtx();
    ctx.inBlock = true;
    const node = { name: { value: 'footer' } };
    compileBlock(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('parentTemplate');
    expect(code).toContain('context.getBlock("footer")');
  });
});

describe('compileSuper', () => {
  test('emits super call with markSafe', () => {
    const ctx = makeCtx();
    const node = {
      blockName: { value: 'header' },
      symbol: { value: 't_1' },
    };
    const frame = { set: () => {} };
    compileSuper(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('context.getSuper(env, "header", b_header');
    expect(code).toContain('runtime.markSafe(t_1)');
  });
});

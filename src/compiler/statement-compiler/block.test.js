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
  test('emits block getBlock call directly', () => {
    const ctx = makeCtx();
    const node = { lineno: 2, colno: 1, name: { value: 'header', lineno: 2, colno: 9 } };
    compileBlock(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('context.getBlock("header", 2, 9)');
    expect(code).toContain('output += t_1');
    expect(code).not.toContain('parentTemplate');
  });

  test('emits block getBlock call when inBlock', () => {
    const ctx = makeCtx();
    ctx.inBlock = true;
    const node = { lineno: 3, colno: 1, name: { value: 'footer', lineno: 3, colno: 9 } };
    compileBlock(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('context.getBlock("footer", 3, 9)');
    expect(code).toContain('output += t_1');
  });
});

describe('compileSuper', () => {
  test('emits super call with markSafe', () => {
    const ctx = makeCtx();
    const node = {
      lineno: 2,
      colno: 12,
      blockName: { value: 'header' },
      symbol: { value: 't_1' },
    };
    const frame = { set: () => {} };
    compileSuper(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('lineno = 2; colno = 12;');
    expect(code).toContain('context.getSuper(env, "header", b_header, frame, runtime, 2, 12)');
    expect(code).toContain('runtime.markSafe(t_1)');
  });
});

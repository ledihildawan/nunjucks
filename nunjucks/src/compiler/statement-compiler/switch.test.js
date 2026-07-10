import { describe, test, expect } from 'bun:test';
import { compileSwitch } from './switch.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    compile: (node) => emitted.push(node.mock),
  };
};

describe('compileSwitch', () => {
  test('emits switch with cases', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'x' },
      cases: [
        { cond: { mock: '1' }, body: { mock: 'body1', children: [{ mock: 'body1' }] } },
        { cond: { mock: '2' }, body: { mock: '', children: [] } },
      ],
    };
    compileSwitch(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('switch (');
    expect(code).toContain('x) {');
    expect(code).toContain('case 1:');
    expect(code).toContain('body1');
    expect(code).toContain('break;');
    expect(code).toContain('case 2:');
    expect(code).not.toContain('default');
  });

  test('emits switch with default case', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'x' },
      cases: [
        { cond: { mock: '1' }, body: { children: [{ mock: 'a' }] } },
      ],
      default: { mock: 'defaultBody' },
    };
    compileSwitch(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('default:');
    expect(code).toContain('defaultBody');
  });

  test('does not emit break for empty case body', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'x' },
      cases: [
        { cond: { mock: '1' }, body: { children: [] } },
      ],
    };
    compileSwitch(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('break');
  });
});

import { describe, test, expect } from 'bun:test';
import { compileIf } from './if.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _withScopedSyntax: (func) => func(),
  };
};

describe('compileIf', () => {
  test('emits if with cond and body', () => {
    const ctx = makeCtx();
    const node = {
      cond: { mock: 'x > 5' },
      body: { mock: 'body' },
    };
    compileIf(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('if(');
    expect(code).toContain('x > 5');
    expect(code).toContain(') {');
    expect(code).toContain('body');
  });

  test('emits if with else block', () => {
    const ctx = makeCtx();
    const node = {
      cond: { mock: 'cond' },
      body: { mock: 'yes' },
      else_: { mock: 'no' },
    };
    compileIf(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('if(');
    expect(code).toContain('cond');
    expect(code).toContain(') {\n');
    expect(code).toContain('yes');
    expect(code).toContain('}\nelse {');
    expect(code).toContain('no');
  });

  test('emits if without else', () => {
    const ctx = makeCtx();
    const node = {
      cond: { mock: 'cond' },
      body: { mock: 'body' },
    };
    compileIf(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('else');
  });
});

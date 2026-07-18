import { describe, test, expect } from 'bun:test';
import { compileImport } from './import.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    _templateName: () => '"test.html"',
  };
};

describe('compileImport', () => {
  test('emits import with getTemplate and getExported', () => {
    const ctx = makeCtx();
    const node = {
      target: { value: 'myLib' },
      template: { type: 'literal', value: 'lib.html', mock: '"lib.html"', lineno: 1, colno: 10 },
      lineno: 1,
      colno: 1,
      withContext: false,
    };
    const frame = { parent: null };
    compileImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('lineno = 1; colno = 11');
    expect(code).toContain('env.getTemplate(');
    expect(code).toContain('t_1.getExported(');
    expect(code).toContain('context.setVariable("myLib"');
  });

  test('includes with context when withContext is true', () => {
    const ctx = makeCtx();
    const node = {
      target: { value: 'myLib' },
      template: { mock: '"lib.html"' },
      lineno: 2,
      colno: 3,
      withContext: true,
    };
    const frame = { parent: null };
    compileImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('context.getVariables(), frame');
  });

  test('uses frame.set when frame has parent', () => {
    const ctx = makeCtx();
    const node = {
      target: { value: 'x' },
      template: { mock: '"lib.html"' },
      lineno: 1,
      colno: 1,
      withContext: false,
    };
    const frame = { parent: {} };
    compileImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('frame.set("x"');
    expect(code).not.toContain('context.setVariable');
  });
});

import { describe, test, expect } from 'bun:test';
import { compileFromImport } from './from-import.js';
import { nodes } from '../../nodes/index.js';

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

describe('compileFromImport', () => {
  test('emits from-import with getTemplate and getExported', () => {
    const ctx = makeCtx();
    const nameNode = nodes.symbol(1, 1, 'foo');
    const node = {
      template: { mock: '"lib.html"' },
      names: { children: [nameNode] },
      lineno: 1,
      colno: 1,
      withContext: false,
    };
    const frame = { parent: null, set: () => {} };
    compileFromImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('env.getTemplate(');
    expect(code).toContain('t_1.getExported(');
    expect(code).toContain('hasOwnProperty.call(t_1_exported, "foo")');
    expect(code).toContain('context.setVariable("foo"');
  });

  test('handles Pair names with alias', () => {
    const ctx = makeCtx();
    const pairNode = nodes.pair(1, 1,
      nodes.symbol(1, 1, 'origName'),
      nodes.symbol(1, 1, 'aliasName'),
    );
    const node = {
      template: { mock: '"lib.html"' },
      names: { children: [pairNode] },
      lineno: 1,
      colno: 1,
      withContext: true,
    };
    const frame = { parent: null, set: () => {} };
    compileFromImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('"origName"');
    expect(code).toContain('context.getVariables(), frame');
    expect(code).toContain('context.setVariable("aliasName"');
  });

  test('emits throw for unknown export', () => {
    const ctx = makeCtx();
    const nameNode = nodes.symbol(1, 1, 'missingExport');
    const node = {
      template: { mock: '"lib.html"' },
      names: { children: [nameNode] },
      lineno: 1,
      colno: 1,
      withContext: false,
    };
    const frame = { parent: null, set: () => {} };
    compileFromImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('Cannot import');
    expect(code).toContain('missingExport');
  });

  test('uses frame.set when frame has parent', () => {
    const ctx = makeCtx();
    const nameNode = nodes.symbol(1, 1, 'x');
    const node = {
      template: { mock: '"lib.html"' },
      names: { children: [nameNode] },
      lineno: 1,
      colno: 1,
      withContext: false,
    };
    const calls = [];
    const frame = {
      parent: {},
      set: (k, v) => { calls.push([k, v]); },
    };
    compileFromImport(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('frame.set("x"');
    expect(code).not.toContain('context.setVariable');
  });
});

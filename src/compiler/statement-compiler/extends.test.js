import { describe, test, expect } from 'bun:test';
import { compileExtends, compileInclude } from './extends.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  return {
    emitted,
    templateName: 'test.html',
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _templateName: () => '"test.html"',
    buffer: 'output',
  };
};

describe('compileExtends', () => {
  test('emits getTemplate and block iteration', () => {
    const ctx = makeCtx();
    const node = {
      template: { mock: '"base.html"' },
      lineno: 1,
      colno: 1,
    };
    compileExtends(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('lineno = 1; colno = 1');
    expect(code).toContain('env.getTemplate(');
    expect(code).toContain('parentTemplate = t_2');
    expect(code).toContain('for(let t_1 in parentTemplate.blocks)');
    expect(code).toContain('context.addBlock(t_1, parentTemplate.blocks[t_1])');
  });
});

describe('compileInclude', () => {
  test('emits getTemplate and render call', () => {
    const ctx = makeCtx();
    const node = {
      template: { mock: '"other.html"' },
      lineno: 2,
      colno: 3,
      ignoreMissing: false,
    };
    compileInclude(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('lineno = 2; colno = 3');
    expect(code).toContain('env.getTemplate(');
    expect(code).toContain('parentLineno: 3, parentColno: 4');
    expect(code).toContain('context.getVariables(), frame');
    expect(code).toContain('output += t_2');
  });

  test('includes ignoreMissing as true', () => {
    const ctx = makeCtx();
    const node = {
      template: { mock: '"maybe.html"' },
      lineno: 3,
      colno: 0,
      ignoreMissing: true,
    };
    compileInclude(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('true');
  });
});

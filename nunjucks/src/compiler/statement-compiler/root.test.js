import { describe, test, expect } from 'bun:test';
import { compileRoot } from './root.js';
import { Block, AstSymbol } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  let buf = 'output';
  return {
    emitted,
    buffer: buf,
    inBlock: false,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _emitLineWithMapping: (s, line, col) => emitted.push(s + '\n'),
    _emitFuncBegin: (node, name) => {
      buf = 'output';
      emitted.push(`async function ${name}(env, context, frame, runtime) {\n`);
      emitted.push(`var lineno = ${node.lineno};\n`);
      emitted.push(`var colno = ${node.colno};\n`);
      emitted.push('var output = "";\n');
      emitted.push('try {\n');
    },
    _emitFuncEnd: (noReturn) => {
      if (!noReturn) {
        emitted.push('return output;\n');
      }
      emitted.push('} catch (e) {\n');
      emitted.push('  throw runtime.handleError(e, lineno, colno);\n');
      emitted.push('}\n');
      emitted.push('}\n');
      buf = null;
    },
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileChildren: (node, frame) => {
      node.children.forEach(child => emitted.push(child.mock));
    },
    compile: (node) => emitted.push(node.mock),
    _templateName: () => '"test.html"',
    fail: (msg) => { throw new Error(msg); },
    get buffer() { return buf; },
    set buffer(v) { buf = v; },
  };
};

describe('compileRoot', () => {
  test('emits root function and block functions', () => {
    const ctx = makeCtx();
    const blockNode = Block(2, 1, AstSymbol(2, 1, 'header'));
    blockNode.body = { mock: 'blockBody' };
    const node = {
      lineno: 1,
      colno: 1,
      children: [blockNode],
      findAll: (type) => {
        if (type === Block) return [blockNode];
        return [];
      },
    };
    compileRoot(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('async function root(env, context, frame, runtime) {');
    expect(code).toContain('var parentTemplate = null;');
    expect(code).toContain('childOutput');
    expect(code).toContain('return await parentTemplate.rootRenderFunc');
    expect(code).toContain('async function b_header(env, context, frame, runtime) {');
    expect(code).toContain('var frame = frame.push(true);');
    expect(code).toContain('b_header: b_header');
    expect(code).toContain('root: root');
  });

  test('fails when frame is passed', () => {
    const ctx = makeCtx();
    const node = { lineno: 1, colno: 1, children: [], findAll: () => [] };
    expect(() => compileRoot(ctx, node, {})).toThrow(
      "compileRoot: root node can't have frame");
  });

  test('throws on duplicate block names', () => {
    const ctx = makeCtx();
    const b1 = Block(1, 1, AstSymbol(1, 1, 'dup'));
    b1.body = { mock: 'body' };
    const b2 = Block(2, 1, AstSymbol(2, 1, 'dup'));
    b2.body = { mock: 'body' };
    const node = {
      lineno: 1,
      colno: 1,
      children: [b1, b2],
      findAll: (type) => {
        if (type === Block) return [b1, b2];
        return [];
      },
    };
    expect(() => compileRoot(ctx, node)).toThrow('Block "dup" defined more than once');
  });
});

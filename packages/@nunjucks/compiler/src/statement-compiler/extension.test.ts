import { describe, test, expect } from 'bun:test';
import { compileCallExtension, compileCallExtensionAsync } from './extension.ts';
import { callExtension, symbol, literal, nodeList } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/lexer';
import type { Compiler } from '../index.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'E'); },
    streamErrorRecovery: false,
    pushBuffer: () => 'buf_1',
    popBuffer: () => {},
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileCallExtension', () => {
  test('emits extension call with context', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = callExtension(ZERO_LOC, {
      ext: { extensionName: 'myExt' },
      prop: 'myMethod',
    });
    compileCallExtension(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getExtension');
    expect(out).toContain('myExt');
    expect(out).toContain('myMethod');
    expect(out).toContain('context');
  });

  test('with args emits argument compilation', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = callExtension(ZERO_LOC, {
      ext: { extensionName: 'myExt' },
      prop: 'myMethod',
      args: nodeList(ZERO_LOC, [literal(ZERO_LOC, 'arg1')]),
    });
    compileCallExtension(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getExtension');
  });

  test('with contentArgs emits async function wrapper', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = callExtension(ZERO_LOC, {
      ext: { extensionName: 'myExt' },
      prop: 'myMethod',
      contentArgs: [symbol(ZERO_LOC, 'content')],
    });
    compileCallExtension(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('async function');
  });

  test('autoescape defaults to true when not boolean', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = callExtension(ZERO_LOC, {
      ext: {},
      prop: 'myMethod',
    });
    compileCallExtension(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getExtension');
  });
});

describe('compileCallExtensionAsync', () => {
  test('delegates to compileCallExtension with async flag', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = callExtension(ZERO_LOC, {
      ext: { extensionName: 'myExt' },
      prop: 'myMethod',
    });
    compileCallExtensionAsync(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getExtension');
  });
});

import { describe, expect, test } from 'bun:test';
import { callExtension, literal, nodeList, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../create-compiler.ts';
import { compileCallExtension, compileCallExtensionAsync } from './extension.ts';
import { makeFullStatementCompiler } from './test-helpers.ts';

describe('compileCallExtension', () => {
  test('emits extension call with context', () => {
    const compiler = makeFullStatementCompiler();
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
    const compiler = makeFullStatementCompiler();
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
    const compiler = makeFullStatementCompiler();
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
    const compiler = makeFullStatementCompiler();
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
    const compiler = makeFullStatementCompiler();
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

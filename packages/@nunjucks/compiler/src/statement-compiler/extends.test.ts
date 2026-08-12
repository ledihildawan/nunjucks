import { describe, test, expect } from 'bun:test';
import { compileExtends, compileInclude } from './extends.ts';
import { extendsNode, include, symbol, literal } from '@nunjucks/nodes';
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
    getTemplateName: () => '"test.html"',
  };
};

describe('compileExtends', () => {
  test('emits parentTemplate assignment and block handling', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    compileExtends(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('parentTemplate =');
    expect(out).toContain('parentTemplate.blocks');
    expect(out).toContain('context.setParentBlockNames');
    expect(out).toContain('context.addBlock');
  });
});

describe('compileInclude', () => {
  test('emits template load and render call', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, { template: literal(ZERO_LOC, 'partial.html'), ignoreMissing: false });
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getTemplate');
    expect(out).toContain('template.render');
  });

  test('with only flag emits empty context render', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, { template: literal(ZERO_LOC, 'partial.html'), ignoreMissing: false });
    (node as unknown as { only: boolean }).only = true;
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('template.render({}, frame)');
  });

  test('with with flag emits forked context', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, { template: literal(ZERO_LOC, 'partial.html'), ignoreMissing: false });
    (node as unknown as { with: ReturnType<typeof symbol> }).with = symbol(ZERO_LOC, 'data');
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('context.fork()');
  });
});

import { describe, expect, test } from 'bun:test';
import { extendsNode, include, literal, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';
import { compileExtends, compileInclude } from './extends.ts';
import { makeExtendsCompiler } from './test-helpers.ts';

describe('compileExtends', () => {
  test('emits parentTemplate assignment and block handling', () => {
    const compiler = makeExtendsCompiler();
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
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, {
      template: literal(ZERO_LOC, 'partial.html'),
      ignoreMissing: false,
    });
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getTemplate');
    expect(out).toContain('template.render');
  });

  test('with only flag emits empty context render', () => {
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, {
      template: literal(ZERO_LOC, 'partial.html'),
      ignoreMissing: false,
    });
    (node as unknown as { only: boolean }).only = true;
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('template.render({}, frame, runtime["__warnings__"])');
  });

  test('with with flag emits forked context', () => {
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = include(ZERO_LOC, {
      template: literal(ZERO_LOC, 'partial.html'),
      ignoreMissing: false,
    });
    (node as unknown as { with: ReturnType<typeof symbol> }).with = symbol(ZERO_LOC, 'data');
    compileInclude(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    // WHY: fork(__withData) — the with-expression flows through fork's spread merge
    // (own-key define semantics) instead of a prototype-unsafe Object.assign.
    expect(out).toContain('context.fork(__withData)');
    expect(out).not.toContain('Object.assign');
  });
});

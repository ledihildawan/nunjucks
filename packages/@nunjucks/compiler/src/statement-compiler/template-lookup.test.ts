import { describe, expect, test } from 'bun:test';
import {
  extendsNode,
  fromImportNode,
  importNode,
  include,
  literal,
  nodeList,
  symbol,
} from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../create-compiler.ts';
import { compileGetTemplate, getTemplateLocation } from './template-lookup.ts';
import { makeExtendsCompiler } from './test-helpers.ts';

describe('getTemplateLocation', () => {
  test('extracts location from extends node', () => {
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    const loc = getTemplateLocation(node);
    expect(loc.lineno).toBe(ZERO_LOC.lineno);
  });

  test('extracts location from include node', () => {
    const node = include(ZERO_LOC, {
      template: literal(ZERO_LOC, 'partial.html'),
      ignoreMissing: false,
    });
    const loc = getTemplateLocation(node);
    expect(loc.lineno).toBe(ZERO_LOC.lineno);
  });

  test('extracts location from import node', () => {
    const node = importNode(ZERO_LOC, { template: literal(ZERO_LOC, 'helpers.html'), target: 'h' });
    const loc = getTemplateLocation(node);
    expect(loc.lineno).toBe(ZERO_LOC.lineno);
  });

  test('extracts location from from-import node', () => {
    const node = fromImportNode(ZERO_LOC, {
      template: literal(ZERO_LOC, 'utils.html'),
      names: nodeList(ZERO_LOC, []),
    });
    const loc = getTemplateLocation(node);
    expect(loc.lineno).toBe(ZERO_LOC.lineno);
  });

  test('string literal adds extra colno', () => {
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    const loc = getTemplateLocation(node);
    expect(loc.colno).toBe(ZERO_LOC.colno + 1);
  });

  test('non-literal does not add extra colno', () => {
    const node = extendsNode(ZERO_LOC, { template: symbol(ZERO_LOC, 'tpl_name') });
    const loc = getTemplateLocation(node);
    expect(loc.colno).toBe(ZERO_LOC.colno);
  });
});

describe('compileGetTemplate', () => {
  test('emits env.getTemplate call', () => {
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    compileGetTemplate({
      compiler: compiler as unknown as Compiler,
      node,
      frame,
      options: { eagerCompile: true, ignoreMissing: false },
    });
    const out = compiler.emitted.join('');
    expect(out).toContain('env.getTemplate');
  });

  test('returns nextCompilerId variable name', () => {
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    const result = compileGetTemplate({
      compiler: compiler as unknown as Compiler,
      node,
      frame,
      options: { eagerCompile: true, ignoreMissing: false },
    });
    expect(result).toMatch(/^t_\d+$/);
  });

  test('passes eagerCompile and ignoreMissing options', () => {
    const compiler = makeExtendsCompiler();
    const frame = createFrame();
    const node = extendsNode(ZERO_LOC, { template: literal(ZERO_LOC, 'base.html') });
    compileGetTemplate({
      compiler: compiler as unknown as Compiler,
      node,
      frame,
      options: { eagerCompile: true, ignoreMissing: false },
    });
    const out = compiler.emitted.join('');
    expect(out).toContain(
      'env.getTemplate({ name: E, eagerCompile: true, ignoreMissing: false });'
    );
  });
});

import { describe, expect, test } from 'bun:test';
import type { ChildrenNode } from '@nunjucks/nodes';
import { block, root, symbol } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileRoot } from './root.ts';
import { makeRootCompiler } from './test-helpers.ts';

describe('compileRoot', () => {
  test('emits root function begin', () => {
    const compiler = makeRootCompiler();
    const node = root(ZERO_LOC, []) as ChildrenNode;
    compileRoot(asCompiler(compiler), node);
    const out = compiler.emitted.join('');
    expect(out).toContain('func:root');
  });

  test('emits parentTemplate null initialization', () => {
    const compiler = makeRootCompiler();
    const node = root(ZERO_LOC, []) as ChildrenNode;
    compileRoot(asCompiler(compiler), node);
    const out = compiler.emitted.join('');
    expect(out).toContain('parentTemplate = null');
  });

  test('compiles non-block children', () => {
    const compiler = makeRootCompiler();
    const node = root(ZERO_LOC, [symbol(ZERO_LOC, 'child')]) as ChildrenNode;
    compileRoot(asCompiler(compiler), node);
    const out = compiler.emitted.join('');
    expect(out).toContain('X');
  });

  test('emits block functions for block children', () => {
    const compiler = makeRootCompiler();
    const blk = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body') });
    const node = root(ZERO_LOC, [blk]) as ChildrenNode;
    compileRoot(asCompiler(compiler), node);
    const out = compiler.emitted.join('');
    expect(out).toContain('func:b_main');
  });

  test('duplicate block names throw', () => {
    const compiler = makeRootCompiler();
    const firstBlock = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body1') });
    const duplicateBlock = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body2') });
    const node = root(ZERO_LOC, [firstBlock, duplicateBlock]) as ChildrenNode;
    expect(() => compileRoot(asCompiler(compiler), node)).toThrow();
  });
});

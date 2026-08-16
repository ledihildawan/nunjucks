import { describe, expect, test } from 'bun:test';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { block, root, symbol } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';
import { compileRoot } from './root.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    emitFuncBegin: (_node: Node, name: string) => {
      emitted.push(`func:${name} `);
    },
    emitFuncEnd: (_isGenerator?: boolean) => {
      emitted.push('end ');
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
    compile: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'X');
    },
    compileExpression: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'E');
    },
    streamErrorRecovery: false,
    pushBuffer: () => 'buf_1',
    popBuffer: () => {},
    withScopedSyntax: (fn: () => void) => fn(),
    inBlock: false,
  };
};

describe('compileRoot', () => {
  test('emits root function begin', () => {
    const compiler = makeCompiler();
    const node = root(ZERO_LOC, []) as ChildrenNode;
    compileRoot(compiler as unknown as Compiler, node);
    const out = compiler.emitted.join('');
    expect(out).toContain('func:root');
  });

  test('emits parentTemplate null initialization', () => {
    const compiler = makeCompiler();
    const node = root(ZERO_LOC, []) as ChildrenNode;
    compileRoot(compiler as unknown as Compiler, node);
    const out = compiler.emitted.join('');
    expect(out).toContain('parentTemplate = null');
  });

  test('compiles non-block children', () => {
    const compiler = makeCompiler();
    const node = root(ZERO_LOC, [symbol(ZERO_LOC, 'child')]) as ChildrenNode;
    compileRoot(compiler as unknown as Compiler, node);
    const out = compiler.emitted.join('');
    expect(out).toContain('X');
  });

  test('emits block functions for block children', () => {
    const compiler = makeCompiler();
    const blk = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body') });
    const node = root(ZERO_LOC, [blk]) as ChildrenNode;
    compileRoot(compiler as unknown as Compiler, node);
    const out = compiler.emitted.join('');
    expect(out).toContain('func:b_main');
  });

  test('duplicate block names throw', () => {
    const compiler = makeCompiler();
    const firstBlock = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body1') });
    const duplicateBlock = block(ZERO_LOC, { name: 'main', body: symbol(ZERO_LOC, 'body2') });
    const node = root(ZERO_LOC, [firstBlock, duplicateBlock]) as ChildrenNode;
    expect(() => compileRoot(compiler as unknown as Compiler, node)).toThrow();
  });
});

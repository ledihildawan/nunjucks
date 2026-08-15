import { describe, expect, test } from 'bun:test';
import type { SlotBlock } from '@nunjucks/nodes';
import { funCall, renderNode, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';
import { compileRenderBlock } from './render.ts';

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
  };
};

describe('compileRenderBlock', () => {
  test('emits frame push and pop', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = renderNode(ZERO_LOC, {
      callExpr: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'render'), args: [] }),
      body: symbol(ZERO_LOC, 'body'),
    });
    compileRenderBlock(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('frame = frame.push(true)');
    expect(out).toContain('frame = frame.pop()');
  });

  test('emits runtime.suppressValue and runtime.awaitValue', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const node = renderNode(ZERO_LOC, {
      callExpr: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'render'), args: [] }),
      body: symbol(ZERO_LOC, 'body'),
    });
    compileRenderBlock(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('runtime.suppressValue');
    expect(out).toContain('runtime.awaitValue');
  });

  test('emits slot functions when provided', () => {
    const compiler = makeCompiler();
    const frame = createFrame();
    const slot: SlotBlock = { name: 'header', params: [], body: symbol(ZERO_LOC, 'slot_body') };
    const node = renderNode(ZERO_LOC, {
      callExpr: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'render'), args: [] }),
      body: symbol(ZERO_LOC, 'body'),
      providedSlots: [slot],
    });
    compileRenderBlock(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('__slot_header');
    expect(out).toContain('slots:');
  });
});

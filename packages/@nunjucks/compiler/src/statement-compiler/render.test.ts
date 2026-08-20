import { describe, expect, test } from 'bun:test';
import type { SlotBlock } from '@nunjucks/nodes';
import { funCall, renderNode, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../create-compiler.ts';
import { compileRenderBlock } from './render.ts';
import { makeFullStatementCompiler } from './test-helpers.ts';

describe('compileRenderBlock', () => {
  test('emits frame push and pop', () => {
    const compiler = makeFullStatementCompiler();
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
    const compiler = makeFullStatementCompiler();
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

  test('emits the tracked html context for the render output position', () => {
    // WHY: regression — the suppressValue options hardcoded context "html", which
    // bypasses attribute-escaping of SafeString markup for renders inside
    // attribute regions; it must follow compiler.getHtmlContext like {{ }} does.
    const compiler = makeFullStatementCompiler();
    const frame = createFrame();
    const node = renderNode(ZERO_LOC, {
      callExpr: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'render'), args: [] }),
      body: symbol(ZERO_LOC, 'body'),
    });
    compileRenderBlock(compiler as unknown as Compiler, { node, frame });
    const out = compiler.emitted.join('');
    expect(out).toContain('context: "ctx:0:0"');
  });

  test('emits slot functions when provided', () => {
    const compiler = makeFullStatementCompiler();
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

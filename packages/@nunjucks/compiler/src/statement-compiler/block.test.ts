import { describe, test, expect } from 'bun:test';
import { compileBlock, compileSuper } from './block.ts';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import type { FrameSetOptions } from '@nunjucks/runtime/frame';

describe('compileBlock', () => {
  test('drains the block via collectString in a string-buffer context', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => { emitted.push(s); },
      tmpid: () => 't_1',
      buffer: 'output',
    };
    compileBlock(asCompiler(ctx), { name: 'content', lineno: 5, colno: 9 } as never);
    expect(emitted[0]).toContain('getBlock("content", 5, 9)');
    expect(emitted[0]).toContain('collectString(');
    expect(emitted[0]).toContain('output += await runtime.collectString(');
  });

  test('delegates via yield* in a generator context', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => { emitted.push(s); },
      tmpid: () => 't_1',
      buffer: null,
    };
    compileBlock(asCompiler(ctx), { name: 'content', lineno: 5, colno: 9 } as never);
    expect(emitted[0]).toContain('yield*');
    expect(emitted[0]).toContain('getBlock("content", 5, 9)');
  });

  test('falls back to the node location when name is a string', () => {
    const emitted: string[] = [];
    const ctx = { emitLine: (s: string) => { emitted.push(s); }, tmpid: () => 't_2', buffer: 'b' };
    compileBlock(asCompiler(ctx), { name: 'main', lineno: 1, colno: 1 } as never);
    expect(emitted[0]).toContain('getBlock("main", 1, 1)');
  });
});

describe('compileSuper', () => {
  test('emits getSuper + markSafe and registers the symbol on the frame', () => {
    const emitted: string[] = [];
    const setCalls: [string, string][] = [];
    const ctx = {
      emitLine: (s: string) => { emitted.push(s); },
    };
    const frame = createFrame();
    const baseSet = frame.set;
    frame.set = (options: FrameSetOptions) => {
      setCalls.push([options.name, String(options.value)]);
      return baseSet({ name: options.name, value: options.value });
    };
    compileSuper(asCompiler(ctx), { node: { blockName: 'content', symbol: { value: 'super' }, lineno: 2, colno: 4 } as never, frame });
    expect(emitted[0]).toBe('lineno = 2; colno = 4;');
    expect(emitted[1]).toContain('context.getSuper({ envObj: env, name: "content", block: b_content, frame, runtime, lineno: 2, colno: 4 })');
    expect(emitted[2]).toContain('runtime.markSafe(super)');
    expect(setCalls).toEqual([['super', 'super']]);
  });
});

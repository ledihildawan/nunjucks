import { describe, test, expect } from 'bun:test';
import { compileBlock, compileSuper } from './block.ts';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

describe('compileBlock', () => {
  test('emits a getBlock lookup for the named block then appends its result to the buffer', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => { emitted.push(s); },
      tmpid: () => 't_1',
      buffer: 'output',
    };
    compileBlock(asCompiler(ctx), { name: 'content', lineno: 5, colno: 9 } as never);
    expect(emitted[0]).toContain('let t_1 = await');
    expect(emitted[0]).toContain('getBlock("content", 5, 9)');
    expect(emitted[1]).toBe('output += t_1;');
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
    frame.set = (k: string, v: unknown) => {
      setCalls.push([k, String(v)]);
      return baseSet(k, v);
    };
    compileSuper(asCompiler(ctx), { blockName: 'content', symbol: { value: 'super' }, lineno: 2, colno: 4 } as never, frame);
    expect(emitted[0]).toBe('lineno = 2; colno = 4;');
    expect(emitted[1]).toContain('getSuper(env, "content", b_content, frame, runtime, 2, 4)');
    expect(emitted[2]).toContain('runtime.markSafe(super)');
    expect(setCalls).toEqual([['super', 'super']]);
  });
});

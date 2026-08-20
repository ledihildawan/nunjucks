import { describe, expect, test } from 'bun:test';
import { block, output, root, superNode, symbol } from '@nunjucks/nodes';
import { createFrame, type FrameSetOptions } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { createCompiler } from '../create-compiler.ts';
import { asCompiler } from '../test-helpers.ts';
import { compileBlock, compileSuper } from './block.ts';

describe('compileBlock', () => {
  test('drains the block via collectString in a string-buffer context', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => {
        emitted.push(s);
      },
      nextCompilerId: () => 't_1',
      buffer: 'output',
    };
    compileBlock(asCompiler(ctx), { name: 'content', lineno: 5, colno: 9 } as never);
    expect(emitted[0]).toContain('getBlock("content", 5, 9)');
    expect(emitted[0]).toContain('collectString(');
    expect(emitted[0]).toContain('output += await runtime.collectString(');
  });

  test('delegates via yield* in a generator context, guarded on extends', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => {
        emitted.push(s);
      },
      nextCompilerId: () => 't_1',
      buffer: null,
    };
    compileBlock(asCompiler(ctx), { name: 'content', lineno: 5, colno: 9 } as never);
    // WHY: under {% extends %} the parent renders the block during delegation, so the
    // in-place yield is wrapped in a parentTemplate guard (prevents double rendering).
    const joined = emitted.join('');
    expect(joined).toContain('if(parentTemplate === null)');
    expect(joined).toContain('yield*');
    expect(joined).toContain('getBlock("content", 5, 9)');
  });

  test('falls back to the node location when name is a string', () => {
    const emitted: string[] = [];
    const ctx = {
      emitLine: (s: string) => {
        emitted.push(s);
      },
      nextCompilerId: () => 't_2',
      buffer: 'b',
    };
    compileBlock(asCompiler(ctx), { name: 'main', lineno: 1, colno: 1 } as never);
    expect(emitted[0]).toContain('getBlock("main", 1, 1)');
  });
});

describe('compileSuper', () => {
  test('emits getSuper + markSafe and registers the symbol on the frame', () => {
    const emitted: string[] = [];
    const setCalls: [string, string][] = [];
    const ctx = {
      emitLine: (s: string) => {
        emitted.push(s);
      },
    };
    const frame = createFrame();
    const baseSet = frame.set;
    frame.set = (options: FrameSetOptions) => {
      setCalls.push([options.name, String(options.value)]);
      return baseSet({ name: options.name, value: options.value });
    };
    compileSuper(asCompiler(ctx), {
      node: { blockName: 'content', symbol: { value: 'super' }, lineno: 2, colno: 4 } as never,
      frame,
    });
    expect(emitted[0]).toBe('lineno = 2; colno = 4;');
    expect(emitted[1]).toContain(
      'context.getSuper({ environment: env, name: "content", block: b_content, frame, runtime, lineno: 2, colno: 4 })'
    );
    expect(emitted[2]).toContain('runtime.markSafe(super)');
    expect(setCalls).toEqual([['super', 'super']]);
  });

  test('declares the lifted super hole symbol with let (no implicit global assignment)', () => {
    const compiler = createCompiler({
      templateName: 'test',
      undefinedMode: undefined,
      source: '',
    });
    compiler.compile(
      root(ZERO_LOC, [
        block(ZERO_LOC, {
          name: 'content',
          body: output(ZERO_LOC, [
            superNode(ZERO_LOC, { blockName: 'content', sym: symbol(ZERO_LOC, 'hole_0') }),
          ]),
        }),
      ]),
      createFrame()
    );
    const code = compiler.getCode();
    expect(code).toContain('let hole_0 = await context.getSuper(');
    expect(code).toContain('hole_0 = runtime.markSafe(hole_0);');
    expect(code).not.toContain('\nhole_0 = await context.getSuper(');
  });
});

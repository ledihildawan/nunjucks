import { describe, test, expect } from 'bun:test';
import { createContext } from '@nunjucks/runtime/context';
import type { Env } from '@nunjucks/runtime/context';

const fakeEnv: Env = {
  opts: { dev: false, autoescape: true, undefined: 'default' },
  getFilter: () => null,
  getTest: () => null,
};

describe('Context', () => {
  test('init stores ctx and env', () => {
    const ctx = createContext({ ctx: { name: 'test' }, env: fakeEnv });
    expect(ctx.ctx.name).toBe('test');
    expect(ctx.env).toBe(fakeEnv);
  });

  test('init creates empty blocks and exported', () => {
    const ctx = createContext({ env: fakeEnv });
    expect(ctx.blocks).toEqual({});
    expect(ctx.exported).toEqual([]);
  });

  test('init registers blocks', () => {
    const blockFn = () => {};
    const ctx = createContext({ blocks: { content: blockFn }, env: fakeEnv });
    expect(ctx.blocks.content).toEqual([blockFn]);
  });

  test('lookup returns context variable', () => {
    const ctx = createContext({ ctx: { name: 'Alice' }, env: fakeEnv });
    expect(ctx.lookup('name')).toBe('Alice');
  });

  test('setVariable stores in context', () => {
    let ctx = createContext({ env: fakeEnv });
    ctx = ctx.setVariable('key', 'val');
    expect(ctx.ctx.key).toBe('val');
  });

  test('getVariables returns ctx', () => {
    const ctx = createContext({ ctx: { a: 1 }, env: fakeEnv });
    expect(ctx.getVariables()).toEqual({ a: 1 });
  });

  test('addBlock appends to block list', () => {
    let ctx = createContext({ env: fakeEnv });
    const fn1 = () => {};
    const fn2 = () => {};
    ctx = ctx.addBlock('main', fn1);
    ctx = ctx.addBlock('main', fn2);
    expect(ctx.blocks.main).toEqual([fn1, fn2]);
  });

  test('addBlock returns a new context with the block', () => {
    const ctx = createContext({ env: fakeEnv });
    const next = ctx.addBlock('main', () => {});
    expect(next).not.toBe(ctx);
    expect(Array.isArray(next.blocks.main)).toBe(true);
  });

  test('getBlock returns first block', () => {
    const fn = () => {};
    const ctx = createContext({ blocks: { main: fn }, env: fakeEnv });
    expect(ctx.getBlock('main')).toBe(fn);
  });

  test('getBlock throws for unknown block', () => {
    const ctx = createContext({ env: fakeEnv });
    expect(() => ctx.getBlock('missing')).toThrow('Undefined block: missing');
  });

  test('getBlock error has code and subject', () => {
    const ctx = createContext({ env: fakeEnv });
    try {
      ctx.getBlock('missing', 3, 9);
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_BLOCK');
      expect((e as { subject: string }).subject).toBe('missing');
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(9);
      expect((e as { lineBase: string }).lineBase).toBe('zero');
    }
  });

  test('validateBlocks uses centralized block location metadata', () => {
    let ctx = createContext({ blocks: { missing: () => {} }, env: fakeEnv, metadata: {
      blockLocations: {
        missing: { lineno: 1, colno: 3 },
      },
    } });
    ctx = ctx.setParentBlockNames(['content']);

    try {
      ctx.validateBlocks();
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_BLOCK');
      expect((e as { subject: string }).subject).toBe('missing');
      expect((e as { lineno: number }).lineno).toBe(1);
      expect((e as { colno: number }).colno).toBe(3);
      expect((e as { lineBase: string }).lineBase).toBe('zero');
    }
  });

  test('getSuper throws when block not found', () => {
    const ctx = createContext({ env: fakeEnv });
    expect(() => ctx.getSuper({ envObj: fakeEnv, name: 'main', block: () => {}, frame: null, runtime: null })).toThrow();
  });

  test('getSuper throws when no next block', () => {
    const fn = () => {};
    const ctx = createContext({ blocks: { main: fn }, env: fakeEnv });
    expect(() => ctx.getSuper({ envObj: fakeEnv, name: 'main', block: fn, frame: null, runtime: null })).toThrow('No super block available');
  });

  test('getSuper errors keep call location', () => {
    const fn = () => {};
    const ctx = createContext({ blocks: { main: fn }, env: fakeEnv });

    try {
      ctx.getSuper({ envObj: fakeEnv, name: 'main', block: fn, frame: null, runtime: null, lineno: 3, colno: 9 });
    } catch (e) {
      expect((e as { code: string }).code).toBe('NO_SUPER_BLOCK');
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(9);
      return;
    }

    throw new Error('Expected getSuper to throw');
  });

  test('getSuper calls next block', async () => {
    const childBlock = (): unknown => 'child result';
    // WHY: Option C — block functions are async generators; the super block yields its content and getSuper drains it to a string.
    const parentBlock = async function* generate(): AsyncGenerator<string> { yield 'parent result'; };
    let ctx = createContext({ blocks: { main: childBlock }, env: fakeEnv });
    ctx = ctx.addBlock('main', parentBlock);
    const result = await ctx.getSuper({ envObj: fakeEnv, name: 'main', block: childBlock, frame: null, runtime: null });
    expect(result).toBe('parent result');
  });

  test('addExport and getExported', () => {
    let ctx = createContext({ ctx: { x: 1, y: 2 }, env: fakeEnv });
    ctx = ctx.addExport('x');
    ctx = ctx.addExport('y');
    expect(ctx.getExported()).toEqual({ x: 1, y: 2 });
  });

  test('getExported returns empty object when no exports', () => {
    const ctx = createContext({ env: fakeEnv });
    expect(ctx.getExported()).toEqual({});
  });
});

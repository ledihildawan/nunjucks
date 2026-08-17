import { describe, expect, test } from 'bun:test';
import { createContext, type Env } from './context.ts';

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
    const firstBlockFn = () => {};
    const secondBlockFn = () => {};
    ctx = ctx.addBlock('main', firstBlockFn);
    ctx = ctx.addBlock('main', secondBlockFn);
    expect(ctx.blocks.main).toEqual([firstBlockFn, secondBlockFn]);
  });

  test('addBlock returns a new context with the block', () => {
    const ctx = createContext({ env: fakeEnv });
    const next = ctx.addBlock('main', () => {});
    expect(next).not.toBe(ctx);
    expect(Array.isArray(next.blocks.main)).toBe(true);
  });

  test('addBlock throws a catalog error for a non-function block', () => {
    const ctx = createContext({ env: fakeEnv });
    try {
      ctx.addBlock('main', 'not-a-function' as unknown as () => void);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NOT_A_FUNCTION');
      expect((e as { subject: string }).subject).toBe('main');
      return;
    }

    throw new Error('Expected addBlock to throw');
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
    let ctx = createContext({
      blocks: { missing: () => {} },
      env: fakeEnv,
      metadata: {
        blockLocations: {
          missing: { lineno: 1, colno: 3 },
        },
      },
    });
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
    expect(() =>
      ctx.getSuper({ envObj: fakeEnv, name: 'main', block: () => {}, frame: null, runtime: null })
    ).toThrow();
  });

  test('getSuper throws when no next block', () => {
    const fn = () => {};
    const ctx = createContext({ blocks: { main: fn }, env: fakeEnv });
    expect(() =>
      ctx.getSuper({ envObj: fakeEnv, name: 'main', block: fn, frame: null, runtime: null })
    ).toThrow('No super block available');
  });

  test('getSuper errors keep call location', () => {
    const fn = () => {};
    const ctx = createContext({ blocks: { main: fn }, env: fakeEnv });

    try {
      ctx.getSuper({
        envObj: fakeEnv,
        name: 'main',
        block: fn,
        frame: null,
        runtime: null,
        lineno: 3,
        colno: 9,
      });
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
    const parentBlock = async function* generate(): AsyncGenerator<string> {
      yield 'parent result';
    };
    let ctx = createContext({ blocks: { main: childBlock }, env: fakeEnv });
    ctx = ctx.addBlock('main', parentBlock);
    const result = await ctx.getSuper({
      envObj: fakeEnv,
      name: 'main',
      block: childBlock,
      frame: null,
      runtime: null,
    });
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

describe('prototype-escape guards (RCE pins)', () => {
  const escapeNames = ['__proto__', 'constructor', 'prototype'] as const;

  test('lookup never resolves inherited Object.prototype members', () => {
    const ctx = createContext({ ctx: {}, env: fakeEnv });
    for (const name of escapeNames) {
      expect(ctx.lookup(name)).toBeUndefined();
    }
  });

  test('lookup still resolves an own prototype-escape binding (host explicit choice)', () => {
    const ctx = createContext({ ctx: { constructor: 'host-owned' }, env: fakeEnv });
    expect(ctx.lookup('constructor')).toBe('host-owned');
  });

  test('getBlock throws UNDEFINED_BLOCK for inherited members instead of returning them', () => {
    const ctx = createContext({ env: fakeEnv });
    for (const name of escapeNames) {
      expect(() => ctx.getBlock(name)).toThrow(`Undefined block: ${name}`);
    }
  });

  test('getBlock still returns an own block stored under a prototype-escape name', () => {
    const fn = () => {};
    const ctx = createContext({ env: fakeEnv }).addBlock('constructor', fn);
    expect(ctx.getBlock('constructor')).toBe(fn);
  });

  test('getSuper throws NO_SUPER_BLOCK for prototype-escape names without an own chain', () => {
    const ctx = createContext({ env: fakeEnv });
    expect(() =>
      ctx.getSuper({ envObj: fakeEnv, name: 'constructor', block: () => {}, frame: null, runtime: null })
    ).toThrow('No super block available');
  });
});

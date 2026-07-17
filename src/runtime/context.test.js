import { describe, test, expect } from 'bun:test';
import { createContext } from './context.js';

const mockEnv = { globals: {} };

describe('Context', () => {
  test('init stores ctx and env', () => {
    const ctx = createContext({ name: 'test' }, {}, mockEnv);
    expect(ctx.ctx.name).toBe('test');
    expect(ctx.env).toBe(mockEnv);
  });

  test('init creates empty blocks and exported', () => {
    const ctx = createContext({}, {}, mockEnv);
    expect(ctx.blocks).toEqual({});
    expect(ctx.exported).toEqual([]);
  });

  test('init registers blocks', () => {
    const blockFn = () => {};
    const ctx = createContext({}, { content: blockFn }, mockEnv);
    expect(ctx.blocks.content).toEqual([blockFn]);
  });

  test('lookup returns context variable', () => {
    const ctx = createContext({ name: 'Alice' }, {}, mockEnv);
    expect(ctx.lookup('name')).toBe('Alice');
  });

  test('lookup returns global when not in context', () => {
    const env = { globals: { siteName: 'MySite' } };
    const ctx = createContext({}, {}, env);
    expect(ctx.lookup('siteName')).toBe('MySite');
  });

  test('lookup prefers context variable over global', () => {
    const env = { globals: { name: 'Global' } };
    const ctx = createContext({ name: 'Local' }, {}, env);
    expect(ctx.lookup('name')).toBe('Local');
  });

  test('setVariable stores in context', () => {
    const ctx = createContext({}, {}, mockEnv);
    ctx.setVariable('key', 'val');
    expect(ctx.ctx.key).toBe('val');
  });

  test('getVariables returns ctx', () => {
    const ctx = createContext({ a: 1 }, {}, mockEnv);
    expect(ctx.getVariables()).toEqual({ a: 1 });
  });

  test('addBlock appends to block list', () => {
    const ctx = createContext({}, {}, mockEnv);
    const fn1 = () => {};
    const fn2 = () => {};
    ctx.addBlock('main', fn1);
    ctx.addBlock('main', fn2);
    expect(ctx.blocks.main).toEqual([fn1, fn2]);
  });

  test('addBlock returns this for chaining', () => {
    const ctx = createContext({}, {}, mockEnv);
    expect(ctx.addBlock('main', () => {})).toBe(ctx);
  });

  test('getBlock returns first block', () => {
    const fn = () => {};
    const ctx = createContext({}, { main: fn }, mockEnv);
    expect(ctx.getBlock('main')).toBe(fn);
  });

  test('getBlock throws for unknown block', () => {
    const ctx = createContext({}, {}, mockEnv);
    expect(() => ctx.getBlock('missing')).toThrow('Undefined block: missing');
  });

  test('getBlock error has code and subject', () => {
    const ctx = createContext({}, {}, mockEnv);
    try {
      ctx.getBlock('missing');
    } catch (e) {
      expect(e.code).toBe('UNDEFINED_BLOCK');
      expect(e.subject).toBe('missing');
    }
  });

  test('validateBlocks uses centralized block location metadata', () => {
    const ctx = createContext({}, { missing: () => {} }, mockEnv, {
      blockLocations: {
        missing: { lineno: 1, colno: 3 }
      }
    });
    ctx.setParentBlockNames(['content']);

    try {
      ctx.validateBlocks();
    } catch (e) {
      expect(e.code).toBe('UNDEFINED_BLOCK');
      expect(e.subject).toBe('missing');
      expect(e.lineno).toBe(1);
      expect(e.colno).toBe(3);
      expect(e.lineBase).toBe('zero');
    }
  });

  test('getSuper throws when block not found', () => {
    const ctx = createContext({}, {}, mockEnv);
    expect(() => ctx.getSuper(mockEnv, 'main', () => {}, null, null))
      .toThrow();
  });

  test('getSuper throws when no next block', () => {
    const fn = () => {};
    const ctx = createContext({}, { main: fn }, mockEnv);
    expect(() => ctx.getSuper(mockEnv, 'main', fn, null, null))
      .toThrow('No super block available');
  });

  test('getSuper calls next block', () => {
    const childBlock = () => 'child result';
    const parentBlock = () => 'parent result';
    const ctx = createContext({}, { main: childBlock }, mockEnv);
    ctx.addBlock('main', parentBlock);
    const result = ctx.getSuper(mockEnv, 'main', childBlock, null, null);
    expect(result).toBe('parent result');
  });

  test('addExport and getExported', () => {
    const ctx = createContext({ x: 1, y: 2 }, {}, mockEnv);
    ctx.addExport('x');
    ctx.addExport('y');
    expect(ctx.getExported()).toEqual({ x: 1, y: 2 });
  });

  test('getExported returns empty object when no exports', () => {
    const ctx = createContext({}, {}, mockEnv);
    expect(ctx.getExported()).toEqual({});
  });
});

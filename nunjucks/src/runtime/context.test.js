import { describe, test, expect } from 'bun:test';
import { Context } from './context.js';

const mockEnv = { globals: {} };

describe('Context', () => {
  test('init stores ctx and env', () => {
    const ctx = new Context({ name: 'test' }, {}, mockEnv);
    expect(ctx.ctx.name).toBe('test');
    expect(ctx.env).toBe(mockEnv);
  });

  test('init creates empty blocks and exported', () => {
    const ctx = new Context({}, {}, mockEnv);
    expect(ctx.blocks).toEqual({});
    expect(ctx.exported).toEqual([]);
  });

  test('init registers blocks', () => {
    const blockFn = () => {};
    const ctx = new Context({}, { content: blockFn }, mockEnv);
    expect(ctx.blocks.content).toEqual([blockFn]);
  });

  test('lookup returns context variable', () => {
    const ctx = new Context({ name: 'Alice' }, {}, mockEnv);
    expect(ctx.lookup('name')).toBe('Alice');
  });

  test('lookup returns global when not in context', () => {
    const env = { globals: { siteName: 'MySite' } };
    const ctx = new Context({}, {}, env);
    expect(ctx.lookup('siteName')).toBe('MySite');
  });

  test('lookup prefers context variable over global', () => {
    const env = { globals: { name: 'Global' } };
    const ctx = new Context({ name: 'Local' }, {}, env);
    expect(ctx.lookup('name')).toBe('Local');
  });

  test('setVariable stores in context', () => {
    const ctx = new Context({}, {}, mockEnv);
    ctx.setVariable('key', 'val');
    expect(ctx.ctx.key).toBe('val');
  });

  test('getVariables returns ctx', () => {
    const ctx = new Context({ a: 1 }, {}, mockEnv);
    expect(ctx.getVariables()).toEqual({ a: 1 });
  });

  test('addBlock appends to block list', () => {
    const ctx = new Context({}, {}, mockEnv);
    const fn1 = () => {};
    const fn2 = () => {};
    ctx.addBlock('main', fn1);
    ctx.addBlock('main', fn2);
    expect(ctx.blocks.main).toEqual([fn1, fn2]);
  });

  test('addBlock returns this for chaining', () => {
    const ctx = new Context({}, {}, mockEnv);
    expect(ctx.addBlock('main', () => {})).toBe(ctx);
  });

  test('getBlock returns first block', () => {
    const fn = () => {};
    const ctx = new Context({}, { main: fn }, mockEnv);
    expect(ctx.getBlock('main')).toBe(fn);
  });

  test('getBlock throws for unknown block', () => {
    const ctx = new Context({}, {}, mockEnv);
    expect(() => ctx.getBlock('missing')).toThrow('unknown block "missing"');
  });

  test('getBlock error has code and subject', () => {
    const ctx = new Context({}, {}, mockEnv);
    try {
      ctx.getBlock('missing');
    } catch (e) {
      expect(e.code).toBe('UNDEFINED_BLOCK');
      expect(e.subject).toBe('missing');
    }
  });

  test('getSuper throws when block not found', () => {
    const ctx = new Context({}, {}, mockEnv);
    expect(() => ctx.getSuper(mockEnv, 'main', () => {}, null, null))
      .toThrow();
  });

  test('getSuper throws when no next block', () => {
    const fn = () => {};
    const ctx = new Context({}, { main: fn }, mockEnv);
    expect(() => ctx.getSuper(mockEnv, 'main', fn, null, null))
      .toThrow('no super block available for "main"');
  });

  test('getSuper calls next block', () => {
    const childBlock = () => 'child result';
    const parentBlock = () => 'parent result';
    const ctx = new Context({}, { main: childBlock }, mockEnv);
    ctx.addBlock('main', parentBlock);
    const result = ctx.getSuper(mockEnv, 'main', childBlock, null, null);
    expect(result).toBe('parent result');
  });

  test('addExport and getExported', () => {
    const ctx = new Context({ x: 1, y: 2 }, {}, mockEnv);
    ctx.addExport('x');
    ctx.addExport('y');
    expect(ctx.getExported()).toEqual({ x: 1, y: 2 });
  });

  test('getExported returns empty object when no exports', () => {
    const ctx = new Context({}, {}, mockEnv);
    expect(ctx.getExported()).toEqual({});
  });
});

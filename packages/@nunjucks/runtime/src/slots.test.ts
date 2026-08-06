import { describe, test, expect } from 'bun:test';
import { createSlotContext, createComponentContext } from '@nunjucks/runtime';

const fn = (_name: string, ret: unknown) => (..._args: unknown[]) => ret;

describe('createSlotContext', () => {
  test('provided slot wins over fallback', () => {
    const ctx = createSlotContext(
      { title: fn('fallback', 'Default') },
      { title: fn('provided', 'Custom') },
    );
    expect(ctx('title')).toBe('Custom');
  });

  test('empty provided slot overrides fallback (explicit empty is a decision)', () => {
    const ctx = createSlotContext(
      { title: fn('fallback', 'Default') },
      { title: fn('empty', '') },
    );
    expect(ctx('title')).toBe('');
  });

  test('fallback used when slot is not provided', () => {
    const ctx = createSlotContext({ title: fn('fallback', 'Default') });
    expect(ctx('title')).toBe('Default');
  });

  test('missing slot renders empty (has() distinguishes provided)', () => {
    const ctx = createSlotContext({ title: fn('fallback', 'Default') });
    expect(ctx('missing')).toBe('');
  });

  test('has() is provided-only: true for provided, false for fallback-only, false for missing', () => {
    const ctx = createSlotContext(
      { title: fn('fallback', 'Default') },
      { footer: fn('provided', 'Footer') },
    );
    expect(ctx.has('footer')).toBe(true);
    expect(ctx.has('title')).toBe(false);
    expect(ctx.has('missing')).toBe(false);
  });

  test('has() is true for explicitly empty provided slot', () => {
    const ctx = createSlotContext({}, { title: fn('empty', '') });
    expect(ctx.has('title')).toBe(true);
  });

  test('dynamic slot name resolution', () => {
    const ctx = createSlotContext({
      header: fn('header', 'H'),
      footer: fn('footer', 'F'),
    });
    expect(ctx('header')).toBe('H');
    expect(ctx('footer')).toBe('F');
  });

  test('scoped props: args are forwarded to the SlotFn', () => {
    const ctx = createSlotContext(
      {},
      { row: (item: unknown) => `row:${String(item)}` },
    );
    expect(ctx('row', 42)).toBe('row:42');
  });

  test('async SlotFn returns promise as-is (renderer awaits)', async () => {
    const ctx = createSlotContext(
      {},
      { body: async () => 'async content' },
    );
    const ret = ctx('body');
    expect(ret).toBeInstanceOf(Promise);
    await expect(ret).resolves.toBe('async content');
  });

  test('fallback receives scoped args too', () => {
    const ctx = createSlotContext({ row: (item: unknown) => `fb:${String(item)}` });
    expect(ctx('row', 'x')).toBe('fb:x');
  });

  test('prototype keys are not treated as slots', () => {
    const ctx = createSlotContext({});
    expect(ctx('constructor')).toBe('');
    expect(ctx.has('constructor')).toBe(false);
  });

  test('works without any fallbacks or provided slots', () => {
    const ctx = createSlotContext({});
    expect(ctx('anything')).toBe('');
    expect(ctx.has('anything')).toBe(false);
  });
});

describe('createComponentContext', () => {
  const slots = createSlotContext({});

  test('assembles props and slots', () => {
    const ctx = createComponentContext({ a: 1 }, slots);
    expect(ctx.props).toEqual({ a: 1 });
    expect(ctx.slots).toBe(slots);
  });
});

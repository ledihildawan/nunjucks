import { describe, expect, test } from 'bun:test';
import { symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';
import { compileSlotFunction } from './slot.ts';
import { makeFullStatementCompiler } from './test-helpers.ts';

describe('compileSlotFunction', () => {
  test('emits slot variable as async function', () => {
    const compiler = makeFullStatementCompiler();
    const parentFrame = createFrame();
    compileSlotFunction({
      compiler: compiler as unknown as Compiler,
      params: [],
      body: symbol(ZERO_LOC, 'body'),
      parentFrame,
      slotVar: '__slot_header',
    });
    const out = compiler.emitted.join('');
    expect(out).toContain('let __slot_header = async');
    expect(out).toContain('runtime.createSafeString');
  });

  test('emits slot frame creation', () => {
    const compiler = makeFullStatementCompiler();
    const parentFrame = createFrame();
    compileSlotFunction({
      compiler: compiler as unknown as Compiler,
      params: [],
      body: symbol(ZERO_LOC, 'body'),
      parentFrame,
      slotVar: '__slot_header',
    });
    const out = compiler.emitted.join('');
    expect(out).toContain('runtime.createFrame');
  });

  test('params are prefixed with l_ and set on frame', () => {
    const compiler = makeFullStatementCompiler();
    const parentFrame = createFrame();
    compileSlotFunction({
      compiler: compiler as unknown as Compiler,
      params: ['title', 'content'],
      body: symbol(ZERO_LOC, 'body'),
      parentFrame,
      slotVar: '__slot_main',
    });
    const out = compiler.emitted.join('');
    expect(out).toContain('l_title');
    expect(out).toContain('l_content');
    expect(out).toContain('frame.set({ name: "title"');
    expect(out).toContain('frame.set({ name: "content"');
  });

  test('compiles body content', () => {
    const compiler = makeFullStatementCompiler();
    const parentFrame = createFrame();
    compileSlotFunction({
      compiler: compiler as unknown as Compiler,
      params: [],
      body: symbol(ZERO_LOC, 'slot_body_content'),
      parentFrame,
      slotVar: '__slot_test',
    });
    const out = compiler.emitted.join('');
    expect(out).toContain('X');
  });
});

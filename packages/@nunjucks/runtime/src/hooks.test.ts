import { describe, expect, test } from 'bun:test';
import { HOOK_EVENTS } from './hooks.ts';

describe('HOOK_EVENTS', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(HOOK_EVENTS)).toBe(true);
  });

  test('exposes the expected event name constants', () => {
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_START).toBe('template:compile:start');
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE).toBe('template:compile:complete');
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR).toBe('template:compile:error');
  });

  test('declares only events that are actually emitted', () => {
    expect(Object.keys(HOOK_EVENTS)).toEqual([
      'TEMPLATE_COMPILE_START',
      'TEMPLATE_COMPILE_COMPLETE',
      'TEMPLATE_COMPILE_ERROR',
    ]);
  });
});

import { describe, test, expect } from 'bun:test';
import { HOOK_EVENTS } from './hooks.ts';

describe('HOOK_EVENTS', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(HOOK_EVENTS)).toBe(true);
  });

  test('exposes the expected event name constants', () => {
    expect(HOOK_EVENTS.TEMPLATE_LOADING).toBe('template:loading');
    expect(HOOK_EVENTS.TEMPLATE_LOADED).toBe('template:loaded');
    expect(HOOK_EVENTS.TEMPLATE_LOAD_ERROR).toBe('template:load:error');
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_START).toBe('template:compile:start');
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE).toBe('template:compile:complete');
    expect(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR).toBe('template:compile:error');
    expect(HOOK_EVENTS.RENDER_START).toBe('render:start');
    expect(HOOK_EVENTS.RENDER_COMPLETE).toBe('render:complete');
    expect(HOOK_EVENTS.RENDER_ERROR).toBe('render:error');
  });
});

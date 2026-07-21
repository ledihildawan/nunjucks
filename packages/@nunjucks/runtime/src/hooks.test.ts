import { describe, test, expect } from 'bun:test';
import { EventEmitter } from 'events';
import { HOOK_EVENTS, globalHooks, createHookEmitter, hookable } from './hooks.ts';

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

describe('globalHooks', () => {
  test('is an EventEmitter', () => {
    expect(globalHooks).toBeInstanceOf(EventEmitter);
  });
});

describe('createHookEmitter', () => {
  test('emitHook calls env.emit with event and augmented payload', () => {
    const calls: { event: string; payload: Record<string, unknown> }[] = [];
    const env = { emit: (event: string, payload: Record<string, unknown>) => calls.push({ event, payload }) };
    const { emitHook } = createHookEmitter(env, { emitGlobal: false });

    emitHook('render:start', { data: 1 });

    expect(calls).toHaveLength(1);
    expect(calls[0].event).toBe('render:start');
    expect(calls[0].payload.data).toBe(1);
    expect(typeof calls[0].payload.timestamp).toBe('number');
  });

  test('envName defaults to null when not provided', () => {
    let payload: Record<string, unknown> | null = null;
    const env = { emit: (_e: string, p: Record<string, unknown>) => { payload = p; } };
    const { emitHook } = createHookEmitter(env, { emitGlobal: false });
    emitHook('render:start', {});
    expect(payload!.envName).toBeNull();
  });

  test('passes configured envName through to the payload', () => {
    let payload: Record<string, unknown> | null = null;
    const env = { emit: (_e: string, p: Record<string, unknown>) => { payload = p; } };
    const { emitHook } = createHookEmitter(env, { envName: 'myEnv', emitGlobal: false });
    emitHook('render:start', {});
    expect(payload!.envName).toBe('myEnv');
  });

  test('emits on global hooks when emitGlobal is true', () => {
    let received: Record<string, unknown> | null = null;
    globalHooks.once('render:complete', (p: Record<string, unknown>) => { received = p; });
    const env = { emit() { /* noop */ } };
    const { emitHook } = createHookEmitter(env, { emitGlobal: true });
    emitHook('render:complete', { ok: true });
    expect(received).not.toBeNull();
    expect((received as { ok: boolean }).ok).toBe(true);
    expect((received as { env: unknown }).env).toBe(env);
  });

  test('does not emit on global hooks when emitGlobal is false', () => {
    let received: unknown = null;
    globalHooks.once('render:error', (p: unknown) => { received = p; });
    const env = { emit() { /* noop */ } };
    const { emitHook } = createHookEmitter(env, { emitGlobal: false });
    emitHook('render:error', {});
    expect(received).toBeNull();
  });

  test('defaults options to emit globally', () => {
    let received: unknown = null;
    globalHooks.once('render:start', (p: unknown) => { received = p; });
    const env = { emit() { /* noop */ } };
    const { emitHook } = createHookEmitter(env);
    emitHook('render:start', {});
    expect(received).not.toBeNull();
  });
});

describe('hookable', () => {
  test('returns the passed function unchanged', () => {
    const fn = () => 1;
    expect(hookable(fn)).toBe(fn);
  });
});

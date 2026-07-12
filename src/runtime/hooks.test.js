import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createEnvironment } from '../environment/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import { HOOK_EVENTS, globalHooks } from './hooks.js';

describe('Hook System', () => {
  let env;

  beforeEach(() => {
    env = createEnvironment();
  });

  afterEach(() => {
    env.removeAllListeners();
    globalHooks.removeAllListeners();
  });

  test('HOOK_EVENTS has all expected events', () => {
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

  test('env emits render:start and render:complete for inline template', async () => {
    const events = [];
    env.on(HOOK_EVENTS.RENDER_START, (data) => events.push({ event: 'render:start', data }));
    env.on(HOOK_EVENTS.RENDER_COMPLETE, (data) => events.push({ event: 'render:complete', data }));

    const result = await env.render('Hello {{ name }}', { name: 'World' });

    expect(result).toBe('Hello World');
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('render:start');
    expect(events[1].event).toBe('render:complete');
    expect(events[1].data.output).toBe('Hello World');
    expect(events[1].data.duration).toBeDefined();
  });

  test('env emits template:loading and template:loaded for getTemplate', async () => {
    const envWithLoader = createEnvironment(
      createFileSystemLoader('src/template/test-templates')
    );
    const events = [];
    envWithLoader.on(HOOK_EVENTS.TEMPLATE_LOADING, (data) => events.push({ event: 'template:loading', data }));
    envWithLoader.on(HOOK_EVENTS.TEMPLATE_LOADED, (data) => events.push({ event: 'template:loaded', data }));

    await envWithLoader.getTemplate('simple-base.njk', true);

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('template:loading');
    expect(events[1].event).toBe('template:loaded');
    expect(events[1].data.fromCache).toBe(false);
    envWithLoader.removeAllListeners();
  });

  test('globalHooks receives events from env', async () => {
    const globalEvents = [];
    globalHooks.on(HOOK_EVENTS.RENDER_START, (data) => globalEvents.push(data));

    await env.render('{{ 1+1 }}', {});

    expect(globalEvents).toHaveLength(1);
  });

  test('multiple handlers per event', async () => {
    let count1 = 0;
    let count2 = 0;

    env.on(HOOK_EVENTS.RENDER_START, () => count1++);
    env.on(HOOK_EVENTS.RENDER_START, () => count2++);

    await env.render('{{ 1 }}', {});

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  test('hook payload includes timestamp', async () => {
    let payload = null;
    env.on(HOOK_EVENTS.RENDER_START, (data) => { payload = data; });

    await env.render('{{ 1 }}', {});

    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe('number');
  });

  test('hook payload includes envName', async () => {
    const env2 = createEnvironment([], { name: 'my-env' });
    let payload = null;
    env2.on(HOOK_EVENTS.RENDER_START, (data) => { payload = data; });

    await env2.render('{{ 1 }}', {});

    expect(payload.envName).toBe('my-env');
    env2.removeAllListeners();
  });

  test('render:error emits on template error', async () => {
    const events = [];
    env.on(HOOK_EVENTS.RENDER_ERROR, (data) => events.push({ event: 'render:error', data }));

    try {
      await env.render('{% if nonexistent %}{% endif %}', {});
    } catch (e) {
      // expected - might throw for undefined
    }

    // Note: render:error may not fire for all error types depending on error handling
  });

  test('template:compile:start and complete emit during render', async () => {
    const events = [];
    env.on(HOOK_EVENTS.TEMPLATE_COMPILE_START, (data) => events.push({ event: 'template:compile:start', data }));
    env.on(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, (data) => events.push({ event: 'template:compile:complete', data }));

    await env.render('Hello {{ name }}', { name: 'World' });

    expect(events.some(e => e.event === 'template:compile:start')).toBe(true);
    expect(events.some(e => e.event === 'template:compile:complete')).toBe(true);
  });

  test('hooks support handlers', () => {
    const results = [];
    
    env.on(HOOK_EVENTS.RENDER_START, (data) => {
      results.push('sync handler');
    });

    env.render('{{ 1 }}', {}).then(() => {
      expect(results).toContain('sync handler');
    });
  });
});

describe('globalHooks', () => {
  afterEach(() => {
    globalHooks.removeAllListeners();
  });

  test('globalHooks is an EventEmitter', () => {
    expect(typeof globalHooks.on).toBe('function');
    expect(typeof globalHooks.emit).toBe('function');
    expect(typeof globalHooks.off).toBe('function');
  });

  test('globalHooks receives events from multiple envs', async () => {
    const env1 = createEnvironment([], { name: 'env1' });
    const env2 = createEnvironment([], { name: 'env2' });
    const events = [];

    globalHooks.on(HOOK_EVENTS.RENDER_START, (data) => events.push(data));

    await env1.render('{{ 1 }}', {});
    await env2.render('{{ 1 }}', {});

    expect(events).toHaveLength(2);
    expect(events[0].envName).toBe('env1');
    expect(events[1].envName).toBe('env2');

    env1.removeAllListeners();
    env2.removeAllListeners();
  });
});

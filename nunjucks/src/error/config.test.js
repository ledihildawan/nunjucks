import { expect, describe, test } from 'bun:test';
import { createConfigStore, errorConfig, getConfig, setErrorConfig } from './config.js';

describe('createConfigStore', () => {
  test('returns config with default values', () => {
    const config = createConfigStore();
    const state = config.get();
    expect(state).toHaveProperty('dev');
    expect(state.ide).toBe('vscode');
    expect(state.version).toBe('3.2.4');
    expect(state.csp).toEqual({ enabled: false, nonceHeader: null, nonceGenerator: null });
  });

  test('get includes dev flag', () => {
    const config = createConfigStore();
    expect(typeof config.get().dev).toBe('boolean');
  });

  test('set overrides ide', () => {
    const config = createConfigStore();
    config.set({ ide: 'cursor' });
    expect(config.get().ide).toBe('cursor');
  });

  test('set overrides version', () => {
    const config = createConfigStore();
    config.set({ version: '4.0.0' });
    expect(config.get().version).toBe('4.0.0');
  });

  test('set merges csp', () => {
    const config = createConfigStore();
    config.set({ csp: { nonce: 'abc' } });
    expect(config.get().csp.nonce).toBe('abc');
    expect(config.get().csp.enabled).toBe(false);
  });

  test('getIde returns ide value', () => {
    const config = createConfigStore();
    expect(config.getIde()).toBe('vscode');
  });

  test('getVersion returns version value', () => {
    const config = createConfigStore({ version: '2.0.0' });
    expect(config.getVersion()).toBe('2.0.0');
  });

  test('getCsp returns copy of csp', () => {
    const config = createConfigStore();
    const csp = config.getCsp();
    csp.enabled = true;
    expect(config.getCsp().enabled).toBe(false);
  });

  test('getCsp includes defaults', () => {
    const config = createConfigStore();
    expect(config.getCsp().nonceHeader).toBeNull();
  });
});

describe('errorConfig singleton', () => {
  test('has expected methods', () => {
    expect(errorConfig.get).toBeInstanceOf(Function);
    expect(errorConfig.set).toBeInstanceOf(Function);
    expect(errorConfig.getIde).toBeInstanceOf(Function);
    expect(errorConfig.getVersion).toBeInstanceOf(Function);
    expect(errorConfig.getCsp).toBeInstanceOf(Function);
  });

  test('get returns dev flag and defaults', () => {
    const state = errorConfig.get();
    expect(typeof state.dev).toBe('boolean');
    expect(state.ide).toBeDefined();
  });
});

describe('getConfig / setErrorConfig', () => {
  test('getConfig returns state from errorConfig', () => {
    const state = getConfig();
    expect(state).toHaveProperty('dev');
    expect(state).toHaveProperty('ide');
  });

  test('setErrorConfig updates errorConfig', () => {
    setErrorConfig({ ide: 'webstorm' });
    expect(getConfig().ide).toBe('webstorm');
  });

  test('setErrorConfig preserves unset defaults', () => {
    expect(getConfig().version).toBe('3.2.4');
  });
});

import { describe, expect, test } from 'bun:test';
import * as runtime from '@nunjucks/runtime';

describe('@nunjucks/runtime barrel', () => {
  test('exports core runtime functions', () => {
    expect(typeof runtime.createFrame).toBe('function');
    expect(typeof runtime.createContext).toBe('function');
    expect(typeof runtime.createRenderRuntime).toBe('function');
    expect(typeof runtime.suppressValue).toBe('function');
    expect(typeof runtime.awaitValue).toBe('function');
    expect(typeof runtime.ensureDefined).toBe('function');
    expect(typeof runtime.execute).toBe('function');
  });

  test('exports member access helpers', () => {
    expect(typeof runtime.memberLookup).toBe('function');
    expect(typeof runtime.slice).toBe('function');
  });

  test('exports sandbox helpers', () => {
    expect(typeof runtime.createSandboxedContext).toBe('function');
  });

  test('exports operator helpers', () => {
    expect(typeof runtime.callWrap).toBe('function');
    expect(typeof runtime.contextOrFrameLookup).toBe('function');
    expect(typeof runtime.handleError).toBe('function');
    expect(typeof runtime.inOperator).toBe('function');
  });

  test('exports safe-string and component helpers', () => {
    expect(typeof runtime.createSafeString).toBe('function');
    expect(typeof runtime.isSafeString).toBe('function');
    expect(typeof runtime.createKeywordArgs).toBe('function');
    expect(typeof runtime.createComponent).toBe('function');
  });

  test('exports constants', () => {
    expect(runtime.HOOK_EVENTS).toBeDefined();
    expect(runtime.UNDEFINED_MODES).toBeDefined();
    expect(runtime.DEFAULT_UNDEFINED_MODE).toBeDefined();
  });
});

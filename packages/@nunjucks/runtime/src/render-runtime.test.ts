import { describe, expect, test } from 'bun:test';
import { createRenderRuntime } from './render-runtime.ts';

describe('createRenderRuntime', () => {
  test('returns all 20 helpers required by compiled code', () => {
    const rt = createRenderRuntime() as Record<string, unknown>;
    const required = [
      'suppressValue',
      'awaitValue',
      'handleError',
      'contextOrFrameLookup',
      'memberLookup',
      'optionalMemberLookup',
      'slice',
      'inOperator',
      'fromIterator',
      'callWrap',
      'ensureDefined',
      'markSafe',
      'createFrame',
      'createSafeString',
      'makeKeywordArgs',
      'makeComponent',
      'createSlotContext',
      'createComponentContext',
      'keys',
      'runTest',
    ];
    for (const key of required) {
      expect(typeof rt[key]).toBe('function');
    }
  });

  test('omits helpers the compiler never emits (dead contract keys)', () => {
    const rt = createRenderRuntime() as Record<string, unknown>;
    expect(rt.nullishCoalesce).toBeUndefined();
    expect(rt.isSafeString).toBeUndefined();
    expect(rt.copySafeness).toBeUndefined();
  });

  test('without options does not include __warnings__ or logContext', () => {
    const rt = createRenderRuntime() as Record<string, unknown>;
    expect(rt.__warnings__).toBeUndefined();
    expect(rt.logContext).toBeUndefined();
  });

  test('with options includes __warnings__ and logContext', () => {
    const rt = createRenderRuntime({ templateName: 'test.njk', renderContext: { x: 1 } }) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(rt.__warnings__)).toBe(true);
    expect((rt.__warnings__ as unknown[]).length).toBe(0);
    expect((rt.logContext as { templateName: string }).templateName).toBe('test.njk');
    expect((rt.logContext as { phase: string }).phase).toBe('render');
    expect((rt.logContext as { renderContext: unknown }).renderContext).toEqual({ x: 1 });
  });

  test('defaults templateName to "inline"', () => {
    const rt = createRenderRuntime({}) as Record<string, unknown>;
    expect((rt.logContext as { templateName: string }).templateName).toBe('inline');
  });

  test('renderContext defaults to null', () => {
    const rt = createRenderRuntime({ templateName: 'x' }) as Record<string, unknown>;
    expect((rt.logContext as { renderContext: unknown }).renderContext).toBeNull();
  });
});

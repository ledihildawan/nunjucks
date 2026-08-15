import { hasOwn } from '@nunjucks/lib';

type SlotFn = (...args: unknown[]) => unknown;

interface SlotContext {
  (name: string, ...args: unknown[]): unknown;
  has: (name: string) => boolean;
}

const createSlotContext = (
  fallbacks: Record<string, SlotFn>,
  provided?: Record<string, SlotFn>
): SlotContext => {
  const resolve = (name: string): SlotFn | undefined => {
    if (provided !== undefined && hasOwn(provided, name)) {
      const candidate = provided[name];
      if (candidate !== undefined) {
        return candidate;
      }
    }
    if (hasOwn(fallbacks, name)) {
      return fallbacks[name];
    }
    return undefined;
  };

  const slot = ((name: string, ...args: unknown[]): unknown => {
    const fn = resolve(name);
    if (fn === undefined) {
      return '';
    }
    return fn(...args);
  }) as SlotContext;

  slot.has = (name: string): boolean =>
    provided !== undefined && hasOwn(provided, name) && provided[name] !== undefined;

  return slot;
};

export type { SlotContext, SlotFn };
export { createSlotContext };

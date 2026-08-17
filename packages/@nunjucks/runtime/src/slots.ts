import { hasOwn } from '@nunjucks/lib';

/** Slot content function signature shared by fallback and provided slot maps. */
type SlotFn = (...args: unknown[]) => unknown;

/**
 * The slot dispatcher passed to components: callable by slot name (unknown or
 * missing slots render as `''`) with a `has` probe that reports only provided,
 * defined slots.
 */
interface SlotContext {
  (name: string, ...args: unknown[]): unknown;
  has: (name: string) => boolean;
}

/** Resolves slot content by name, preferring provided slots over fallbacks. */
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

  // WHY: the callable is augmented with `slot.has` right after; TS cannot type "function plus
  // subsequently assigned property" in one expression, so the cast asserts the final SlotContext shape.
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

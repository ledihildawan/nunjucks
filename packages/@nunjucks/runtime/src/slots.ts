// SlotContext is callable: `slot(name, ...args)` resolves and invokes the
// SlotFn. Precedence is provided[name] ?? fallback[name]; an explicitly
// provided empty slot overrides the fallback (mirrors Vue/Svelte).
import { hasOwn } from '@nunjucks/shared';

type SlotFn = (...args: unknown[]) => unknown;

interface SlotContext {
  (name: string, ...args: unknown[]): unknown;
  has: (name: string) => boolean;
}

const createSlotContext = (
  fallbacks: Record<string, SlotFn>,
  provided?: Record<string, SlotFn>,
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
      // Missing slots render empty — `{{ children }}` / `{{ slot("x") }}`
      // must not print "undefined". Use `slot.has(name)` to distinguish
      // "not provided" from "provided empty".
      return '';
    }
    return fn(...args);
  }) as SlotContext;

  slot.has = (name: string): boolean =>
    provided !== undefined && hasOwn(provided, name) && provided[name] !== undefined;

  return slot;
};

export { createSlotContext };
export type { SlotFn, SlotContext };

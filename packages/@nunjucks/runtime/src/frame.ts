// FRAME - Execution frame with cached lookups
// Import directly: import { createFrame, lookup } from '@nunjucks/runtime/frame'

const lookupCache = new Map<string, unknown>();

export interface Frame {
  readonly parent: Frame | null;
  readonly bindings: Map<string, unknown>;
  lookup: (name: string) => unknown;
  set: (name: string, value: unknown) => void;
  resolve: (name: string) => unknown;
}

export const createFrame = (parent: Frame | null = null): Frame => {
  const bindings = new Map<string, unknown>();
  
  const resolve = (name: string): unknown => {
    const cached = lookupCache.get(name);
    if (cached !== undefined) return cached;
    
    if (bindings.has(name)) return bindings.get(name);
    if (parent) return parent.resolve(name);
    return undefined;
  };
  
  return Object.freeze({
    parent,
    bindings,
    lookup: resolve,
    set: (name: string, value: unknown) => {
      lookupCache.set(name, value);
      bindings.set(name, value);
    }
  });
};

export const lookup = (frame: Frame, name: string): unknown => frame.lookup(name);
export const set = (frame: Frame, name: string, value: unknown): void => frame.set(name, value);

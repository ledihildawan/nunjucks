// CONTEXT - Runtime context management
// Import directly: import { createContext } from '@nunjucks/runtime/context'

import { createFrame, type Frame } from './frame.ts';

export interface Context {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  has: (key: string) => boolean;
  fork: (data?: Record<string, unknown>) => Context;
  toObject: () => Record<string, unknown>;
}

const createScope = (data: Record<string, unknown> = {}, parent: Context | null = null) => ({
  data: new Map(Object.entries(data)),
  parent
});

export const createContext = (initialData: Record<string, unknown> = {}): Context => {
  const scope = createScope(initialData, null);
  
  const get = (key: string): unknown => {
    let current: typeof scope | null = scope;
    while (current) {
      if (current.data.has(key)) return current.data.get(key);
      current = current.parent;
    }
    return undefined;
  };
  
  const set = (key: string, value: unknown): void => {
    scope.data.set(key, value);
  };
  
  const has = (key: string): boolean => {
    let current: typeof scope | null = scope;
    while (current) {
      if (current.data.has(key)) return true;
      current = current.parent;
    }
    return false;
  };
  
  const fork = (data: Record<string, unknown> = {}): Context => {
    const newScope = createScope(data, scope);
    return createContextFromScope(newScope);
  };
  
  const toObject = (): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const seen = new Set<string>();
    let current: typeof scope | null = scope;
    while (current) {
      for (const [k, v] of current.data) {
        if (!seen.has(k)) {
          seen.add(k);
          result[k] = v;
        }
      }
      current = current.parent;
    }
    return result;
  };
  
  return Object.freeze({ get, set, has, fork, toObject });
};

const createContextFromScope = (scope: ReturnType<typeof createScope>): Context => {
  const get = (key: string): unknown => {
    let current: typeof scope | null = scope;
    while (current) {
      if (current.data.has(key)) return current.data.get(key);
      current = current.parent;
    }
    return undefined;
  };
  
  const set = (key: string, value: unknown): void => {
    scope.data.set(key, value);
  };
  
  const has = (key: string): boolean => {
    let current: typeof scope | null = scope;
    while (current) {
      if (current.data.has(key)) return true;
      current = current.parent;
    }
    return false;
  };
  
  const fork = (data: Record<string, unknown> = {}): Context => {
    const newScope = createScope(data, scope);
    return createContextFromScope(newScope);
  };
  
  const toObject = (): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const seen = new Set<string>();
    let current: typeof scope | null = scope;
    while (current) {
      for (const [k, v] of current.data) {
        if (!seen.has(k)) {
          seen.add(k);
          result[k] = v;
        }
      }
      current = current.parent;
    }
    return result;
  };
  
  return Object.freeze({ get, set, has, fork, toObject });
};

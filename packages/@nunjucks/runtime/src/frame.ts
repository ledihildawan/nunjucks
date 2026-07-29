// FRAME - Execution frame with cached lookups
// Import directly: import { createFrame } from '@nunjucks/runtime/frame'

export interface Frame {
  variables: Record<string, unknown>;
  readonly rootState: { revision: number };
  parent: Frame | undefined;
  topLevel: boolean;
  readonly isolateWrites: boolean | undefined;
  set: (name: string, val: unknown, resolveUp?: boolean) => void;
  get: (name: string) => unknown;
  lookup: (name: string) => unknown;
  resolve: (name: string, forWrite?: boolean) => Frame | undefined;
  push: (writeIsolation?: boolean) => Frame;
  pop: () => Frame | undefined;
}

const setNestedValue = (target: Record<string, unknown>, path: string[], lastPart: string, val: unknown): void => {
  const current = path.reduce<Record<string, unknown>>((acc, id) => {
    if (!acc[id]) {
      acc[id] = {};
    }
    return acc[id] as Record<string, unknown>;
  }, target);
  current[lastPart] = val;
};

export function createFrame(parent?: Frame | null, isolateWrites?: boolean): Frame {
  // The cast has to keep `undefined`: with no parent there is no rootState,
  // and the `??` below is what supplies the initial one.
  const rootState: { revision: number } = (parent?.rootState as { revision: number } | undefined) ?? { revision: 0 };
  const state: {
    variables: Record<string, unknown>;
    parent: Frame | undefined;
    topLevel: boolean;
    isolateWrites: boolean | undefined;
    rootState: { revision: number };
    resolveCache: Map<string, { revision: number; frame: Frame | undefined }>;
    lookupCache: Map<string, unknown>;
  } = {
    variables: Object.create(null),
    parent: parent ?? undefined,
    topLevel: false,
    isolateWrites,
    rootState,
    resolveCache: new Map(),
    lookupCache: new Map(),
  };

  const frame: Frame = {
    get variables(): Record<string, unknown> {
      return state.variables;
    },
    set variables(val: Record<string, unknown>) {
      state.variables = val;
      state.rootState.revision += 1;
      state.resolveCache.clear();
      state.lookupCache.clear();
    },
    get rootState(): { revision: number } {
      return state.rootState;
    },
    get parent(): Frame | undefined {
      return state.parent;
    },
    set parent(val: Frame | undefined) {
      state.parent = val;
    },
    get topLevel(): boolean {
      return state.topLevel;
    },
    set topLevel(val: boolean) {
      state.topLevel = val;
    },
    get isolateWrites(): boolean | undefined {
      return state.isolateWrites;
    },

    set(name: string, val: unknown, resolveUp?: boolean): void {
      const parts = name.split('.');
      const [firstPart] = parts;
      const lastPart = parts.at(-1);
      // split() always yields at least one element, but say so rather than assert it.
      if (firstPart === undefined || lastPart === undefined) { return; }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved) {
          resolved.set(name, val);
          return;
        }
      }

      setNestedValue(state.variables, parts.slice(0, -1), lastPart, val);
      state.rootState.revision += 1;
      state.resolveCache.clear();
      state.lookupCache.clear();
    },

    get(name: string): unknown {
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return null;
    },

    lookup(name: string): unknown {
      const cached = state.lookupCache.get(name);
      if (cached !== undefined) {
        return cached;
      }

      const p = state.parent;
      const val = state.variables[name];
      const result = val === undefined ? p?.lookup(name) : val;
      state.lookupCache.set(name, result);
      return result;
    },

    resolve(name: string, forWrite?: boolean): Frame | undefined {
      const forWriteVal = forWrite ? 1 : 0;
      const cacheKey = `${name}\u0000${forWriteVal}`;
      const cached = state.resolveCache.get(cacheKey);
      if (cached && cached.revision === state.rootState.revision) {
        return cached.frame;
      }

      const shouldBailOut = forWrite && state.isolateWrites;
      if (shouldBailOut) { return; }

      const val = state.variables[name];
      if (val !== undefined) {
        state.resolveCache.set(cacheKey, { revision: state.rootState.revision, frame });
        return frame;
      }

      const resolvedFrame = state.parent?.resolve(name);
      state.resolveCache.set(cacheKey, { revision: state.rootState.revision, frame: resolvedFrame });
      return resolvedFrame;
    },

    push(writeIsolation?: boolean): Frame {
      return createFrame(frame, writeIsolation);
    },

    pop(): Frame | undefined {
      return state.parent;
    },
  };

  return frame;
}

export const lookup = (frame: Frame, name: string): unknown => frame.lookup(name);
export const set = (frame: Frame, name: string, value: unknown): void => {
  frame.set(name, value);
};

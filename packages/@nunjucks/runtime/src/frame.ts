export interface Frame {
  variables: Record<string, unknown>;
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

export const createFrame = (parent?: Frame | null, isolateWrites?: boolean): Frame => {
  const state: {
    variables: Record<string, unknown>;
    parent: Frame | undefined;
    topLevel: boolean;
    isolateWrites: boolean | undefined;
  } = {
    variables: Object.create(null),
    parent: parent ?? undefined,
    topLevel: false,
    isolateWrites,
  };

  const frame: Frame = {
    get variables(): Record<string, unknown> {
      return state.variables;
    },
    set variables(val: Record<string, unknown>) {
      state.variables = val;
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
      if (firstPart === undefined || lastPart === undefined) { return; }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved) {
          resolved.set(name, val);
          return;
        }
      }

      setNestedValue(state.variables, parts.slice(0, -1), lastPart, val);
    },

    get(name: string): unknown {
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return null;
    },

    lookup(name: string): unknown {
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return state.parent?.lookup(name);
    },

    resolve(name: string, forWrite?: boolean): Frame | undefined {
      if (forWrite && state.isolateWrites) { return; }

      const val = state.variables[name];
      if (val !== undefined) {
        return frame;
      }
      return state.parent?.resolve(name);
    },

    push(writeIsolation?: boolean): Frame {
      return createFrame(frame, writeIsolation);
    },

    pop(): Frame | undefined {
      return state.parent;
    },
  };

  return frame;
};

export const lookup = (frame: Frame, name: string): unknown => frame.lookup(name);

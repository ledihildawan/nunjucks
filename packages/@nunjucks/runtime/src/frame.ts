export interface Frame {
  variables: Record<string, unknown>;
  parent: Frame | undefined;
  topLevel: boolean;
  readonly isolateWrites: boolean | undefined;
  set: (name: string, value: unknown, resolveUp?: boolean) => void;
  get: (name: string) => unknown;
  lookup: (name: string) => unknown;
  resolve: (name: string, forWrite?: boolean) => Frame | undefined;
  push: (writeIsolation?: boolean) => Frame;
  pop: () => Frame | undefined;
}

const setNestedValue = (target: Record<string, unknown>, path: string[], lastPart: string, value: unknown): void => {
  const current = path.reduce<Record<string, unknown>>((acc, id) => {
    if (!acc[id]) {
      acc[id] = {};
    }
    return acc[id] as Record<string, unknown>;
  }, target);
  current[lastPart] = value;
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
    set variables(value: Record<string, unknown>) {
      state.variables = value;
    },
    get parent(): Frame | undefined {
      return state.parent;
    },
    set parent(value: Frame | undefined) {
      state.parent = value;
    },
    get topLevel(): boolean {
      return state.topLevel;
    },
    set topLevel(value: boolean) {
      state.topLevel = value;
    },
    get isolateWrites(): boolean | undefined {
      return state.isolateWrites;
    },

    // WHY: the Frame is render-time lexical-scope execution state — set() mutates variables in place, and the resolveUp path writes through to PARENT frames up the scope chain (shared by reference). This shared-reference scope-chain semantics is the imperative shell of template rendering (the guide endorses Functional Core / Imperative Shell); making it immutable would require threading new parent frames up the chain on every write — a deep execution-model redesign that is over-engineering for a guide-allowed shell.
    set(name: string, value: unknown, resolveUp?: boolean): void {
      const parts = name.split('.');
      const [firstPart] = parts;
      const lastPart = parts.at(-1);
      if (firstPart === undefined || lastPart === undefined) { return; }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved) {
          resolved.set(name, value);
          return;
        }
      }

      setNestedValue(state.variables, parts.slice(0, -1), lastPart, value);
    },

    get(name: string): unknown {
      const value = state.variables[name];
      if (value !== undefined) {
        return value;
      }
      return null;
    },

    lookup(name: string): unknown {
      const value = state.variables[name];
      if (value !== undefined) {
        return value;
      }
      return state.parent?.lookup(name);
    },

    resolve(name: string, forWrite?: boolean): Frame | undefined {
      if (forWrite && state.isolateWrites) { return; }

      const value = state.variables[name];
      if (value !== undefined) {
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

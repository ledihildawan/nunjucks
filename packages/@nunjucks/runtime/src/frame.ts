export interface Frame {
  variables: Record<string, unknown>;
  parent: Frame | undefined;
  topLevel: boolean;
  readonly isolateWrites: boolean | undefined;
  set: (name: string, value: unknown, resolveUp?: boolean) => Frame;
  get: (name: string) => unknown;
  lookup: (name: string) => unknown;
  resolve: (name: string, forWrite?: boolean) => Frame | undefined;
  push: (writeIsolation?: boolean) => Frame;
  pop: () => Frame | undefined;
}

const setNestedValueImmutable = (target: Record<string, unknown>, path: string[], lastPart: string, value: unknown): Record<string, unknown> => {
  if (path.length === 0) {
    return { ...target, [lastPart]: value };
  }
  const head = path[0];
  if (head === undefined) { return target; }
  const rest = path.slice(1);
  const child = (target[head] ?? {}) as Record<string, unknown>;
  return { ...target, [head]: setNestedValueImmutable(child, rest, lastPart, value) };
};

interface FrameState {
  variables: Record<string, unknown>;
  parent: Frame | undefined;
  topLevel: boolean;
  isolateWrites: boolean | undefined;
}

export const createFrame = (parent?: Frame | null, isolateWrites?: boolean, variables?: Record<string, unknown>, topLevel?: boolean): Frame => {
  const state: FrameState = {
    variables: variables ?? Object.create(null),
    parent: parent ?? undefined,
    topLevel: topLevel ?? false,
    isolateWrites,
  };

  const frame: Frame = {
    get variables(): Record<string, unknown> { return state.variables; },
    set variables(value: Record<string, unknown>) { state.variables = value; },
    get parent(): Frame | undefined { return state.parent; },
    set parent(value: Frame | undefined) { state.parent = value; },
    get topLevel(): boolean { return state.topLevel; },
    set topLevel(value: boolean) { state.topLevel = value; },
    get isolateWrites(): boolean | undefined { return state.isolateWrites; },

    // WHY: immutable scope-chain write — returns a NEW frame rather than mutating in place. The resolveUp path functionally rebuilds the chain from the resolved (parent) frame up to the current frame (a persistent-list update), so the caller reassigns `frame = frame.set(...)` and the new binding threads through without shared-reference mutation.
    set(name: string, value: unknown, resolveUp?: boolean): Frame {
      const parts = name.split('.');
      const [firstPart] = parts;
      const lastPart = parts.at(-1);
      if (firstPart === undefined || lastPart === undefined) { return frame; }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved && resolved !== frame) {
          const newResolvedVars = setNestedValueImmutable(resolved.variables, parts.slice(0, -1), lastPart, value);
          return rebuildChain(frame, resolved, newResolvedVars);
        }
      }

      const newVariables = setNestedValueImmutable(state.variables, parts.slice(0, -1), lastPart, value);
      return createFrame(state.parent, state.isolateWrites, newVariables, state.topLevel);
    },

    get(name: string): unknown {
      const value = state.variables[name];
      return value !== undefined ? value : null;
    },

    lookup(name: string): unknown {
      const value = state.variables[name];
      if (value !== undefined) { return value; }
      return state.parent?.lookup(name);
    },

    resolve(name: string, forWrite?: boolean): Frame | undefined {
      if (forWrite && state.isolateWrites) { return; }
      if (state.variables[name] !== undefined) { return frame; }
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

const rebuildChain = (root: Frame, target: Frame, newTargetVariables: Record<string, unknown>): Frame => {
  const path: Frame[] = [];
  let cur: Frame | undefined = root;
  while (cur && cur !== target) {
    path.push(cur);
    cur = cur.parent;
  }
  if (!cur) { return root; }

  let newFrame = createFrame(target.parent, target.isolateWrites, newTargetVariables, target.topLevel);
  for (let i = path.length - 1; i >= 0; i--) {
    const node = path[i];
    if (!node) { continue; }
    newFrame = createFrame(newFrame, node.isolateWrites, node.variables, node.topLevel);
  }
  return newFrame;
};

export const lookup = (frame: Frame, name: string): unknown => frame.lookup(name);

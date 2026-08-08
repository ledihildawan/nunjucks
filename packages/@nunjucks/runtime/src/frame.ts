import { reduce } from 'remeda';

export interface Frame {
  readonly variables: Record<string, unknown>;
  readonly parent: Frame | undefined;
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
    get parent(): Frame | undefined { return state.parent; },
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
  const collectPath = (cur: Frame | undefined, acc: Frame[]): Frame[] | null => {
    if (!cur) { return null; }
    if (cur === target) { return acc; }
    return collectPath(cur.parent, [...acc, cur]);
  };
  const path = collectPath(root, []);
  if (!path) { return root; }

  const baseFrame = createFrame(target.parent, target.isolateWrites, newTargetVariables, target.topLevel);
  return reduce(
    [...path].reverse(),
    (acc, node) => createFrame(acc, node.isolateWrites, node.variables, node.topLevel),
    baseFrame,
  );
};

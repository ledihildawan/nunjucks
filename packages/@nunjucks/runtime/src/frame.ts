import { reduce } from 'remeda';
import type { Frame, CreateFrameOptions } from './runtime-contract/frame.ts';

export type { Frame, CreateFrameOptions };

interface SetNestedInput {
  target: Record<string, unknown>;
  parts: string[];
  value: unknown;
}

const setNestedValueImmutable = ({ target, parts, value }: SetNestedInput): Record<string, unknown> => {
  if (parts.length === 0) { return target; }
  const lastPart = parts.at(-1);
  if (lastPart === undefined) { return target; }
  if (parts.length === 1) {
    return { ...target, [lastPart]: value };
  }
  const head = parts[0];
  if (head === undefined) { return target; }
  const child = (target[head] ?? {}) as Record<string, unknown>;
  return { ...target, [head]: setNestedValueImmutable({ target: child, parts: parts.slice(1), value }) };
};

interface FrameState {
  variables: Record<string, unknown>;
  parent: Frame | undefined;
  topLevel: boolean;
  isolateWrites: boolean | undefined;
}

export const createFrame = (options: CreateFrameOptions = {}): Frame => {
  const state: FrameState = {
    variables: options.variables ?? Object.create(null),
    parent: options.parent ?? undefined,
    topLevel: options.topLevel ?? false,
    isolateWrites: options.isolateWrites,
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
      if (firstPart === undefined || parts.length === 0) { return frame; }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved && resolved !== frame) {
          const newResolvedVars = setNestedValueImmutable({ target: resolved.variables, parts, value });
          return rebuildChain({ root: frame, target: resolved, newTargetVariables: newResolvedVars });
        }
      }

      const newVariables = setNestedValueImmutable({ target: state.variables, parts, value });
      return createFrame({ parent: state.parent, isolateWrites: state.isolateWrites, variables: newVariables, topLevel: state.topLevel });
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
      return createFrame({ parent: frame, isolateWrites: writeIsolation });
    },

    pop(): Frame | undefined {
      return state.parent;
    },
  };

  return frame;
};

interface RebuildChainInput {
  root: Frame;
  target: Frame;
  newTargetVariables: Record<string, unknown>;
}

const rebuildChain = ({ root, target, newTargetVariables }: RebuildChainInput): Frame => {
  const collectPath = (cur: Frame | undefined, acc: Frame[]): Frame[] | null => {
    if (!cur) { return null; }
    if (cur === target) { return acc; }
    return collectPath(cur.parent, [...acc, cur]);
  };
  const path = collectPath(root, []);
  if (!path) { return root; }

  const baseFrame = createFrame({ parent: target.parent, isolateWrites: target.isolateWrites, variables: newTargetVariables, topLevel: target.topLevel });
  return reduce(
    [...path].reverse(),
    (acc, node) => createFrame({ parent: acc, isolateWrites: node.isolateWrites, variables: node.variables, topLevel: node.topLevel }),
    baseFrame,
  );
};

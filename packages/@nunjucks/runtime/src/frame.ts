import { reduce } from 'remeda';
import type { CreateFrameOptions, Frame, FrameSetOptions } from './runtime-contract/frame.ts';

export type { CreateFrameOptions, Frame, FrameSetOptions };

interface SetNestedInput {
  target: Record<string, unknown>;
  parts: string[];
  value: unknown;
}

const setNestedValueImmutable = ({
  target,
  parts,
  value,
}: SetNestedInput): Record<string, unknown> => {
  if (parts.length === 0) {
    return target;
  }
  const lastPart = parts.at(-1);
  if (lastPart === undefined) {
    return target;
  }
  if (parts.length === 1) {
    return { ...target, [lastPart]: value };
  }
  const head = parts[0];
  if (head === undefined) {
    return target;
  }
  const child = (target[head] ?? {}) as Record<string, unknown>;
  return {
    ...target,
    [head]: setNestedValueImmutable({ target: child, parts: parts.slice(1), value }),
  };
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
    get variables(): Record<string, unknown> {
      return state.variables;
    },
    get parent(): Frame | undefined {
      return state.parent;
    },
    get topLevel(): boolean {
      return state.topLevel;
    },
    get isolateWrites(): boolean | undefined {
      return state.isolateWrites;
    },

    set({ name, value, resolveUp = false }: FrameSetOptions): Frame {
      const parts = name.split('.');
      const [firstPart] = parts;
      if (firstPart === undefined || parts.length === 0) {
        return frame;
      }

      if (resolveUp) {
        const resolved = frame.resolve(firstPart, true);
        if (resolved && resolved !== frame) {
          const newResolvedVars = setNestedValueImmutable({
            target: resolved.variables,
            parts,
            value,
          });
          return rebuildChain({
            root: frame,
            target: resolved,
            newTargetVariables: newResolvedVars,
          });
        }
      }

      const newVariables = setNestedValueImmutable({ target: state.variables, parts, value });
      return createFrame({
        parent: state.parent,
        isolateWrites: state.isolateWrites,
        variables: newVariables,
        topLevel: state.topLevel,
      });
    },

    get(name: string): unknown {
      return state.variables[name];
    },

    lookup(name: string): unknown {
      const value = state.variables[name];
      if (value !== undefined) {
        return value;
      }
      return state.parent?.lookup(name);
    },

    resolve(name: string, forWrite?: boolean): Frame | undefined {
      if (forWrite && state.isolateWrites) {
        return;
      }
      if (state.variables[name] !== undefined) {
        return frame;
      }
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
  const collectPath = (currentFrame: Frame | undefined, acc: Frame[]): Frame[] | null => {
    if (!currentFrame) {
      return null;
    }
    if (currentFrame === target) {
      return acc;
    }
    return collectPath(currentFrame.parent, [...acc, currentFrame]);
  };
  const path = collectPath(root, []);
  if (!path) {
    return root;
  }

  const baseFrame = createFrame({
    parent: target.parent,
    isolateWrites: target.isolateWrites,
    variables: newTargetVariables,
    topLevel: target.topLevel,
  });
  return reduce(
    [...path].reverse(),
    (acc, node) =>
      createFrame({
        parent: acc,
        isolateWrites: node.isolateWrites,
        variables: node.variables,
        topLevel: node.topLevel,
      }),
    baseFrame
  );
};

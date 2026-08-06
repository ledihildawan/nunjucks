import { hasOwn } from '@nunjucks/shared';
import type { SlotContext } from './slots.ts';

type KeywordArgs = Record<string, unknown> & { keywords: boolean };

const isKeywordArgsObject = (value: unknown): value is KeywordArgs =>
  typeof value === 'object' && value !== null && hasOwn(value, 'keywords');

interface ComponentContext {
  props: Record<string, unknown>;
  slots: SlotContext;
}

const createComponentContext = (
  props: Record<string, unknown>,
  slots: SlotContext,
): ComponentContext => ({ props, slots });

export function makeComponent(argNames: string[], kwargNames: string[], func: (...args: never[]) => unknown): (...componentArgs: unknown[]) => unknown {
  return function component(this: unknown, ...componentArgs: unknown[]): unknown {
    const argCount = numArgs(componentArgs);
    const kwargs = { ...getKeywordArgs(componentArgs) };

    const args = argCount > argNames.length
      ? ((): unknown[] => {
          const extraArgs = componentArgs.slice(argNames.length, argCount);
          const extraKwargs = Object.fromEntries(
            extraArgs
              .map((val, i) => [kwargNames[i], val] as [string | undefined, unknown])
              .filter((entry): entry is [string, unknown] => entry[0] !== undefined)
          );
          return [...componentArgs.slice(0, argNames.length), { ...kwargs, ...extraKwargs }];
        })()
      : argCount < argNames.length
        ? ((): unknown[] => {
            const missingNames = argNames.slice(argCount);
            const consumedSet = new Set(missingNames);
            const remainingKwargs = makeKeywordArgs(
              Object.fromEntries(Object.entries(kwargs).filter(([k]) => !consumedSet.has(k)))
            );
            return [...componentArgs.slice(0, argCount), ...missingNames.map(arg => kwargs[arg]), remainingKwargs];
          })()
        : componentArgs;

    return Reflect.apply(func, this, args);
  };
}

export const makeKeywordArgs = <T extends Record<string, unknown>>(obj: T): T & { keywords: true } => ({
  ...obj,
  keywords: true,
});

export const getKeywordArgs = (args: unknown[]): Record<string, unknown> => {
  const kwargObjs = args.filter(isKeywordArgsObject);
  if (kwargObjs.length === 0) {
    return {};
  }
  return Object.assign({}, ...kwargObjs);
};

export const numArgs = (args: unknown[]): number => {
  const len = args.length;
  if (len === 0) {
    return 0;
  }

  const lastArg = args[len - 1];
  if (isKeywordArgsObject(lastArg)) {
    return len - 1;
  }
  return len;
};

export { createComponentContext };
export type { ComponentContext };

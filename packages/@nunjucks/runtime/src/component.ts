import { hasOwn } from '@nunjucks/lib';
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
  slots: SlotContext
): ComponentContext => ({ props, slots });

interface CreateComponentOptions<A extends unknown[], R> {
  argNames: string[];
  kwargNames: string[];
  func: (...args: A) => R;
  optionsArg?: boolean;
}

export function createComponent<A extends unknown[], R>({
  argNames,
  kwargNames,
  func,
  optionsArg = false,
}: CreateComponentOptions<A, R>): (...componentArgs: unknown[]) => R {
  return function component(this: unknown, ...componentArgs: unknown[]): R {
    const argCount = numArgs(componentArgs);
    const kwargs = { ...getKeywordArgs(componentArgs) };

    if (optionsArg) {
      const positional = componentArgs.slice(0, argCount);
      const namedKwargs = kwargs;
      const positionalOptions = positional.reduce<Record<string, unknown>>((acc, value, index) => {
        const name = index === 0 ? argNames[0] : kwargNames[index - 1];
        if (name !== undefined && value !== undefined) {
          acc[name] = value;
        }
        return acc;
      }, {});

      // WHY: Reflect.apply's return is typed any; the cast re-asserts R, the component's
      // declared return generic captured at createComponent time.
      return Reflect.apply(func, this, [{ ...positionalOptions, ...namedKwargs }]) as R;
    }

    const args = resolveComponentArgs({ componentArgs, argNames, kwargNames, kwargs, argCount });

    return Reflect.apply(func, this, args) as R;
  };
}

interface ResolveComponentArgsInput {
  componentArgs: unknown[];
  argNames: readonly string[];
  kwargNames: readonly string[];
  kwargs: Record<string, unknown>;
  argCount: number;
}

// WHY: positional/keyword reconciliation — extra positionals past the named arity fold into
// the trailing kwargs object; missing names are filled from kwargs (or undefined) so the
// component always receives exactly `argNames.length` positional slots.
const resolveComponentArgs = ({
  componentArgs,
  argNames,
  kwargNames,
  kwargs,
  argCount,
}: ResolveComponentArgsInput): unknown[] => {
  if (argCount > argNames.length) {
    const extraArgs = componentArgs.slice(argNames.length, argCount);
    const extraKwargs = Object.fromEntries(
      extraArgs
        .map((value, index) => [kwargNames[index], value] as [string | undefined, unknown])
        .filter((entry): entry is [string, unknown] => entry[0] !== undefined)
    );
    return [...componentArgs.slice(0, argNames.length), { ...kwargs, ...extraKwargs }];
  }

  if (argCount < argNames.length) {
    const missingNames = argNames.slice(argCount);
    const consumedSet = new Set(missingNames);
    const remainingKwargs = createKeywordArgs(
      Object.fromEntries(Object.entries(kwargs).filter(([name]) => !consumedSet.has(name)))
    );
    return [
      ...componentArgs.slice(0, argCount),
      ...missingNames.map((argument) => kwargs[argument]),
      remainingKwargs,
    ];
  }

  return componentArgs;
};

export const createKeywordArgs = (
  record: Record<string, unknown>
): Record<string, unknown> & { keywords: true } => ({
  ...record,
  keywords: true,
});

export const getKeywordArgs = (args: unknown[]): Record<string, unknown> => {
  const kwargObjs = args.filter(isKeywordArgsObject);
  if (kwargObjs.length === 0) {
    return {};
  }
  // WHY: fromEntries uses define-own semantics — a template-authored '__proto__' key in
  // kwargs becomes an own property instead of retargeting the merge target's prototype
  // the way Object.assign's [[Set]] merge would; mirrors context.fork's merge convention.
  return Object.fromEntries(kwargObjs.flatMap((kwargObj) => Object.entries(kwargObj)));
};

export const numArgs = (args: unknown[]): number => {
  // WHY: count NON-keyword args anywhere in the list — the previous last-position-only
  // check miscounted when a caller appended a second keyword envelope (e.g. {% render %}
  // merges its slots envelope after user kwargs), letting the first envelope bind
  // positionally. getKeywordArgs already merges every keyword object.
  return args.reduce<number>(
    (count, arg) => count + (isKeywordArgsObject(arg) ? 0 : 1),
    0
  );
};

export type { ComponentContext };
export { createComponentContext };

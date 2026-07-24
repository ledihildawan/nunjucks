// MACRO - Macro/keyword-args handling for Nunjucks templates
import { hasOwn } from '@nunjucks/shared/type-guards';

type KeywordArgs = Record<string, unknown> & { keywords: boolean };

type RuntimeFunction = (...args: never[]) => unknown;

const isKeywordArgsObject = (value: unknown): value is KeywordArgs =>
  typeof value === 'object' && value !== null && hasOwn(value, 'keywords');

export function makeMacro(argNames: string[], kwargNames: string[], func: RuntimeFunction): (...macroArgs: unknown[]) => unknown {
  return function macro(this: unknown, ...macroArgs: unknown[]): unknown {
    const argCount = numArgs(macroArgs);
    let args: unknown[];
    const kwargs = getKeywordArgs(macroArgs);

    if (argCount > argNames.length) {
      args = macroArgs.slice(0, argNames.length);
      macroArgs.slice(args.length, argCount).forEach((val, i) => {
        if (i < kwargNames.length) {
          const kwName = kwargNames[i]!;
          kwargs[kwName] = val;
        }
      });
      args.push(kwargs);
    } else if (argCount < argNames.length) {
      args = macroArgs.slice(0, argCount);
      for (let i = argCount; i < argNames.length; i++) {
        const arg = argNames[i]!;
        args.push(kwargs[arg]);
        delete kwargs[arg];
      }
      args.push(kwargs);
    } else {
      args = macroArgs;
    }

    return (func as (...a: unknown[]) => unknown).apply(this, args);
  };
}

export function makeKeywordArgs<T>(obj: T): T & { keywords: boolean } {
  (obj as { keywords?: boolean }).keywords = true;
  return obj as T & { keywords: boolean };
}

export function isKeywordArgs(obj: unknown): boolean | null {
  if (obj === null || obj === undefined) { return null; }
  return isKeywordArgsObject(obj);
}

export function getKeywordArgs(args: unknown[]): Record<string, unknown> {
  if (args.length > 0) {
    const lastArg = args.at(-1);
    if (isKeywordArgsObject(lastArg)) {
      return lastArg;
    }
  }
  return {};
}

export function numArgs(args: unknown[]): number {
  const len = args.length;
  if (len === 0) {
    return 0;
  }

  const lastArg = args[len - 1];
  if (isKeywordArgsObject(lastArg)) {
    return len - 1;
  }
    return len;
}

export function withKwargs<T extends RuntimeFunction>(func: T): T {
  return function (this: unknown, ...args: unknown[]): unknown {
    const positionalArgs: unknown[] = [];
    const kwargs: Record<string, unknown> = {};

    for (const arg of args) {
      if (isKeywordArgs(arg)) {
        Object.assign(kwargs, arg);
      } else {
        positionalArgs.push(arg);
      }
    }

    return (func as unknown as (this: unknown, ...args: unknown[]) => unknown).apply(this, [...positionalArgs, kwargs]);
  } as unknown as T;
}

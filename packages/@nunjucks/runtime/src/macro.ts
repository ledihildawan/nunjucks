// MACRO - Macro/keyword-args handling for Nunjucks templates
type KeywordArgs = { keywords?: boolean; [key: string]: unknown } & Record<string, unknown>;

export function makeMacro(argNames: string[], kwargNames: string[], func: (...args: any[]) => unknown): (...macroArgs: unknown[]) => unknown {
  return function macro(this: unknown, ...macroArgs: unknown[]): unknown {
    const argCount = numArgs(macroArgs);
    let args: unknown[];
    const kwargs = getKeywordArgs(macroArgs) as KeywordArgs;

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
  return obj && Object.hasOwn(obj, 'keywords') ? true : (obj ? false : null);
}

export function getKeywordArgs(args: unknown[]): Record<string, unknown> {
  if (args.length) {
    const lastArg = args.at(-1) as Record<string, unknown>;
    if (isKeywordArgs(lastArg)) {
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
  if (isKeywordArgs(lastArg)) {
    return len - 1;
  } else {
    return len;
  }
}

export function withKwargs<T extends (...args: any[]) => unknown>(func: T): T {
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

    return (func as (...a: unknown[]) => unknown).apply(this, [...positionalArgs, kwargs]);
  } as T;
}

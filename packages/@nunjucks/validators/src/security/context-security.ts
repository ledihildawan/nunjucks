import { isKeyedObject } from '@nunjucks/lib';
import { isFunction, keys } from 'remeda';
import { isDangerousReference, getBlockedKeyCategory, isDangerousGlobal } from '@nunjucks/shared';
import { JS_BUILTIN_CONSTRUCTORS } from '../js-builtins.ts';

const isBlockedNestedContextKey = (key: string): boolean =>
  getBlockedKeyCategory(key, 'auto') === 'object_intrinsic';

const BUILTIN_GLOBALS = new Set(JS_BUILTIN_CONSTRUCTORS);

const isBuiltIn = (name: string): boolean => BUILTIN_GLOBALS.has(name);

interface ScanContext {
  allowedGlobals?: readonly string[] | null;
  seen: WeakSet<object>;
}

interface ScanState {
  scan: ScanContext;
  isTopLevel: boolean;
  currentPath: string;
}

const checkKeyDangerous = (key: string, { isTopLevel, currentPath }: ScanState): string[] => {
  if (isBlockedNestedContextKey(key)) {
    return [currentPath];
  }
  if (isTopLevel && isDangerousGlobal(key)) {
    return [currentPath];
  }
  return [];
};

const checkValueDangerous = (
  value: unknown,
  key: string,
  { scan, isTopLevel, currentPath }: ScanState
): string[] => {
  if (!isFunction(value) || !isTopLevel) {
    return [];
  }
  const fnName = value.name || key;
  // WHY: eval/Function are members of shared's UNIVERSAL_GLOBALS, so isDangerousGlobal
  // already covers them — no special-cased literals here.
  const dangerous =
    isDangerousGlobal(fnName) ||
    (!!scan.allowedGlobals && !scan.allowedGlobals.includes(fnName) && !isBuiltIn(fnName));
  return dangerous ? [currentPath] : [];
};

const scanForDangerousValues = (context: unknown, state: ScanState): string[] => {
  const { scan, currentPath: path, isTopLevel } = state;
  if (!isKeyedObject(context) || scan.seen.has(context)) {
    return [];
  }
  scan.seen.add(context);

  const record = context as Record<string, unknown>;
  return keys(record).flatMap((key) => {
    const childPath = path ? `${path}.${key}` : key;
    const value = record[key];
    const entryState: ScanState = { scan, isTopLevel, currentPath: childPath };
    const nested =
      value && typeof value === 'object' && !isDangerousReference(value)
        ? scanForDangerousValues(value, { scan, isTopLevel: false, currentPath: childPath })
        : [];

    return [
      ...checkKeyDangerous(key, entryState),
      ...checkValueDangerous(value, key, entryState),
      ...(isDangerousReference(value) ? [childPath] : []),
      ...nested,
    ];
  });
};

export const findDangerousValues = (
  context: unknown,
  allowedGlobals?: readonly string[] | null
): string[] => {
  const paths = scanForDangerousValues(context, {
    scan: { allowedGlobals, seen: new WeakSet() },
    isTopLevel: true,
    currentPath: '',
  });
  return [...new Set(paths)];
};

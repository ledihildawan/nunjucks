import { keys, isFunction } from 'remeda';
import { getBlockedKeyCategory, isDangerousGlobal } from './blocked-keys.ts';

const globalRecord = globalThis as Record<string, unknown>;

const isPrimitive = (value: unknown): boolean => value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function');

const checkGlobalThis = (value: unknown): boolean => typeof globalThis !== 'undefined' && value === globalThis;
const checkProcess = (value: unknown): boolean => globalRecord.process !== undefined && value === globalRecord.process;
const checkWindow = (value: unknown): boolean => globalRecord.window !== undefined && value === globalRecord.window;
const checkDocument = (value: unknown): boolean => globalRecord.document !== undefined && value === globalRecord.document;
const checkSelf = (value: unknown): boolean => globalRecord.self !== undefined && value === globalRecord.self;
const checkBuffer = (value: unknown): boolean => typeof Buffer !== 'undefined' && value instanceof Buffer;

export const isDangerousReference = (value: unknown): boolean => {
  if (isPrimitive(value)) { return false; }
  return checkGlobalThis(value) || checkProcess(value) || checkWindow(value) || checkDocument(value) || checkSelf(value) || checkBuffer(value);
};

const isBlockedNestedContextKey = (key: string): boolean => getBlockedKeyCategory(key, 'auto') === 'object_intrinsic';

const BUILTIN_GLOBALS = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError'
]);

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

const checkValueDangerous = (value: unknown, key: string, { scan, isTopLevel, currentPath }: ScanState): string[] => {
  if (!isFunction(value) || !isTopLevel) { return []; }
  const fnName = value.name || key;
  const dangerous = (fnName === 'eval' || fnName === 'Function')
    || isDangerousGlobal(fnName)
    || (!!scan.allowedGlobals && !scan.allowedGlobals.includes(fnName) && !isBuiltIn(fnName));
  return dangerous ? [currentPath] : [];
};

const scanForDangerousValues = (context: unknown, state: ScanState): string[] => {
  const { scan, currentPath: path, isTopLevel } = state;
  if (!context || typeof context !== 'object' || scan.seen.has(context as object)) {
    return [];
  }
  scan.seen.add(context as object);

  return keys(context as Record<string, unknown>).flatMap(key => {
    const childPath = path ? `${path}.${key}` : key;
    const value = (context as Record<string, unknown>)[key];
    const entryState: ScanState = { scan, isTopLevel, currentPath: childPath };
    const nested = value && typeof value === 'object' && !isDangerousReference(value)
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

export const findDangerousValues = (context: unknown, allowedGlobals?: readonly string[] | null): string[] => {
  const paths = scanForDangerousValues(context, { scan: { allowedGlobals, seen: new WeakSet() }, isTopLevel: true, currentPath: '' });
  return [...new Set(paths)];
};

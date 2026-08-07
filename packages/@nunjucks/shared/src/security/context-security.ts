import { keys, isFunction } from 'remeda';
import { getBlockedKeyCategory, isDangerousGlobal } from './blocked-keys.ts';
import process from 'node:process';

const globalRecord = globalThis as Record<string, unknown>;

const isPrimitive = (value: unknown): boolean => value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function');

const checkGlobalThis = (value: unknown): boolean => typeof globalThis !== 'undefined' && value === globalThis;
const checkProcess = (value: unknown): boolean => typeof process !== 'undefined' && value === process;
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

const checkKeyDangerous = (
  key: string,
  _value: unknown,
  isTopLevel: boolean,
  _scan: ScanContext,
  currentPath: string
): string[] => {
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
  isTopLevel: boolean,
  scan: ScanContext,
  currentPath: string
): string[] => {
  if (!isFunction(value) || !isTopLevel) { return []; }
  const fnName = value.name || key;
  const dangerous = (fnName === 'eval' || fnName === 'Function')
    || isDangerousGlobal(fnName)
    || (!!scan.allowedGlobals && !scan.allowedGlobals.includes(fnName) && !isBuiltIn(fnName));
  return dangerous ? [currentPath] : [];
};

export const scanForDangerousValues = (
  obj: unknown,
  scan: ScanContext,
  path = '',
  isTopLevel = true
): string[] => {
  if (!obj || typeof obj !== 'object' || scan.seen.has(obj as object)) {
    return [];
  }
  scan.seen.add(obj as object);

  return keys(obj as Record<string, unknown>).flatMap(key => {
    const currentPath = path ? `${path}.${key}` : key;
    const value = (obj as Record<string, unknown>)[key];
    const nested = value && typeof value === 'object' && !isDangerousReference(value)
      ? scanForDangerousValues(value, scan, currentPath, false)
      : [];

    return [
      ...checkKeyDangerous(key, value, isTopLevel, scan, currentPath),
      ...checkValueDangerous(value, key, isTopLevel, scan, currentPath),
      ...(isDangerousReference(value) ? [currentPath] : []),
      ...nested,
    ];
  });
};

export const findDangerousValues = (obj: unknown, allowedGlobals?: readonly string[] | null): string[] => {
  const paths = scanForDangerousValues(obj, { allowedGlobals, seen: new WeakSet() });
  return [...new Set(paths)];
};

// biome-ignore lint/style/noExcessiveLinesPerFile: Security module with security-related utility functions
import { keys, isFunction, pipe, map, join } from 'remeda';
import { getBlockedKeyCategory, isBlockedKey, isDangerousGlobal } from '@nunjucks/shared/blocked-keys';
import process from "node:process";

const isObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

const globalRecord = globalThis as Record<string, unknown>;

const isPrimitive = (value: unknown): boolean => value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function');

const checkGlobalThis = (value: unknown): boolean => typeof globalThis !== 'undefined' && value === globalThis;
const checkProcess = (value: unknown): boolean => typeof process !== 'undefined' && value === process;
const checkWindow = (value: unknown): boolean => globalRecord.window !== undefined && value === globalRecord.window;
const checkDocument = (value: unknown): boolean => globalRecord.document !== undefined && value === globalRecord.document;
const checkSelf = (value: unknown): boolean => globalRecord.self !== undefined && value === globalRecord.self;
const checkBuffer = (value: unknown): boolean => typeof Buffer !== 'undefined' && value instanceof Buffer;

const isDangerousReference = (value: unknown): boolean => {
  if (isPrimitive(value)) { return false; }
  return checkGlobalThis(value) || checkProcess(value) || checkWindow(value) || checkDocument(value) || checkSelf(value) || checkBuffer(value);
};

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/u, message: 'eval() is not allowed' },
  { pattern: /\bFunction\s*\(/u, message: 'Function constructor is not allowed' },
  { pattern: /\brequire\s*\(/u, message: 'require() is not allowed' },
  { pattern: /\bimport\s+\(/u, message: 'dynamic import() is not allowed' },
];

const IDENTIFIER_PATTERN = /[a-zA-Z_$][\w$]*/u;

const getLineColFromIndex = (content: string, index: number): { line: number; col: number } => {
  const beforeMatch = content.slice(0, index);
  const lines = beforeMatch.split('\n');
  const line = lines.length;
  const col = lines.at(-1)?.length ?? 0;
  return { line, col };
};

interface BlockedKeyResult {
  key: string;
  reason: string;
}

interface ValidateContextKeysResult {
  valid: boolean;
  blocked: BlockedKeyResult[];
}

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf'
]);

const isPrototypePollutionKey = (key: string): boolean => PROTOTYPE_POLLUTION_KEYS.has(key);

const isBlockedNestedContextKey = (key: string): boolean => getBlockedKeyCategory(key, 'auto') === 'object_intrinsic';

const BUILTIN_GLOBALS = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError'
]);

const isBuiltIn = (name: string): boolean => BUILTIN_GLOBALS.has(name);

/** What stays fixed for one whole scan; only the value and its path change. */
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
  if (isPrototypePollutionKey(key) || isBlockedNestedContextKey(key)) {
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
  if (!isFunction(value)) { return []; }
  const fnName = value.name || key;
  return [
    ...(isTopLevel && (fnName === 'eval' || fnName === 'Function') ? [currentPath] : []),
    ...(isTopLevel && isDangerousGlobal(fnName) ? [currentPath] : []),
    ...(isTopLevel && scan.allowedGlobals && !scan.allowedGlobals.includes(fnName) && !isBuiltIn(fnName) ? [currentPath] : []),
  ];
};

const scanForDangerousValues = (
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

/** Public entry: starts a fresh scan with its own cycle-tracking set. */
const findDangerousValues = (obj: unknown, allowedGlobals?: readonly string[] | null): string[] =>
  scanForDangerousValues(obj, { allowedGlobals, seen: new WeakSet() });

const visitAndScrub = <V>(value: V, seen: WeakSet<object>): V => {
  if (!value || typeof value !== 'object' || seen.has(value as object)) { return value; }
  seen.add(value as object);
  const record = value as Record<string, unknown>;
  keys(record).forEach(key => {
    const child = record[key];
    if (isDangerousReference(child)) {
      delete record[key];
    } else if (child && typeof child === 'object') {
      visitAndScrub(child, seen);
    }
  });
  return value;
};

const scrubDangerousReferences = <T>(context: T, _allowedGlobals: readonly string[] | null): T => {
  const seen = new WeakSet<object>();
  return visitAndScrub(context, seen);
};

export interface SecurityError extends Error {
  code: string;
  dangerousPaths?: string[];
}

export const createSecurityError = (message: string, code = 'SECURITY_VIOLATION'): SecurityError => {
  const err = new Error(message) as SecurityError;
  err.name = 'SecurityError';
  err.code = code;
  return err;
};

export const isSecurityError = (e: unknown): e is SecurityError =>
  e instanceof Error && (e as Error).name === 'SecurityError';

export interface DangerousCodeViolation {
  message: string;
  pattern: string;
  line: number;
  col: number;
  name: string | null;
}

export const scanTemplateForDangerousCode = (templateContent: string): DangerousCodeViolation[] =>
  DANGEROUS_PATTERNS.flatMap(({ pattern, message }) => {
    const regex = new RegExp(pattern.source, 'gu');
    const matches = [...templateContent.matchAll(regex)];
    return matches.map(match => {
      const matchIndex = match.index;
      const { line, col } = getLineColFromIndex(templateContent, matchIndex);
      const nameMatch = match[0].match(IDENTIFIER_PATTERN);
      const [name = null] = nameMatch ?? [];
      return { message, pattern: pattern.source, line, col, name };
    });
  });

export const validateContextKeys = (
  context: unknown,
  allowedKeys: readonly string[] | null = null,
  blockedKeys: readonly string[] | null = null
): ValidateContextKeysResult => {
  if (!isObject(context) || isFunction(context)) {
    return { valid: true, blocked: [] };
  }

  const contextKeys = pipe(context, keys());
  const blocked = contextKeys.flatMap((key): BlockedKeyResult[] => {
    if (isBlockedKey(key)) {
      return [{ key, reason: 'blocked key' }];
    }
    if (allowedKeys && !allowedKeys.includes(key)) {
      return [{ key, reason: 'not in allowed keys' }];
    }
    if (blockedKeys?.includes(key)) {
      return [{ key, reason: 'in blocked keys list' }];
    }
    return [];
  });

  return {
    valid: blocked.length === 0,
    blocked
  };
};

export interface ValidateContextOptions {
  allowedKeys?: readonly string[] | null;
  blockedKeys?: readonly string[] | null;
  allowedGlobals?: readonly string[] | null;
  scanValues?: boolean;
}

export const validateContext = (context: unknown, options: ValidateContextOptions = {}): true => {
  const {
    allowedKeys = null,
    blockedKeys = null,
    allowedGlobals = null,
    scanValues = false
  } = options;

  const keyValidation = validateContextKeys(context, allowedKeys, blockedKeys);
  if (!keyValidation.valid) {
    const err = createSecurityError(
      `Cannot use blocked keys in context: ${pipe(keyValidation.blocked, map(b => b.key), join(', '))}`,
      'BLOCKED_CONTEXT_KEYS'
    );
    err.dangerousPaths = keyValidation.blocked.map(b => b.key);
    throw err;
  }

  if (scanValues) {
    const dangerousValues = findDangerousValues(context, allowedGlobals);
    if (dangerousValues.length > 0) {
      const err = createSecurityError(
        `Context contains unsafe values: ${dangerousValues.join(', ')}`,
        'DANGEROUS_CONTEXT_VALUES'
      );
      err.dangerousPaths = dangerousValues;
      throw err;
    }
  }

  return true;
};

export { findDangerousValues, scrubDangerousReferences, isDangerousReference };

export const restrictGlobals = (
  context: Record<string, unknown>,
  allowedGlobals: readonly string[] = []
): Record<string, unknown> => {
  const allowed = new Set(allowedGlobals);
  return keys(context).reduce<Record<string, unknown>>((restricted, key) => {
    if (!(isDangerousGlobal(key) && !allowed.has(key))) {
      restricted[key] = context[key];
    }
    return restricted;
  }, {});
};

export interface CreateSecurityValidatorOptions extends ValidateContextOptions {
  strictMode?: boolean;
}

export interface SecurityValidator {
  validateContext: (context: unknown) => true;
  scanTemplate: (content: string) => DangerousCodeViolation[];
  options: CreateSecurityValidatorOptions;
}

export const createSecurityValidator = (options: CreateSecurityValidatorOptions = {}): SecurityValidator => {
  const {
    allowedKeys = null,
    blockedKeys = null,
    allowedGlobals = null,
    scanValues = false,
    strictMode = false
  } = options;

  return {
    validateContext: (context: unknown): true => {
      const effectiveAllowedGlobals: readonly string[] | null = strictMode ? [] : allowedGlobals;
      return validateContext(context, {
        allowedKeys,
        blockedKeys,
        allowedGlobals: effectiveAllowedGlobals,
        scanValues: strictMode || scanValues
      });
    },

    scanTemplate: (content: string): DangerousCodeViolation[] => {
      const violations = scanTemplateForDangerousCode(content);
      if (violations.length > 0 && strictMode) {
        throw createSecurityError(
          `Template contains unsafe code: ${pipe(violations, map(v => v.message), join('; '))}`,
          'DANGEROUS_TEMPLATE_CODE'
        );
      }
      return violations;
    },

    options
  };
};

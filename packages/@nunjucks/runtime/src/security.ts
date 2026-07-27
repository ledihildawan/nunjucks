import { keys, isFunction } from 'remeda';
import { getBlockedKeyCategory, isBlockedKey, isDangerousGlobal } from '@nunjucks/shared/blocked-keys';
import process from "node:process";

const isObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

const globalRecord = globalThis as Record<string, unknown>;

const isDangerousReference = (value: unknown): boolean => {
  if (value === null || value === undefined) { return false; }
  if (typeof value !== 'object' && typeof value !== 'function') { return false; }
  if (typeof globalThis !== 'undefined' && value === globalThis) { return true; }
  if (typeof process !== 'undefined' && value === process) { return true; }
  if (globalRecord.window !== undefined && value === globalRecord.window) { return true; }
  if (globalRecord.document !== undefined && value === globalRecord.document) { return true; }
  if (globalRecord.self !== undefined && value === globalRecord.self) { return true; }
  if (typeof Buffer !== 'undefined' && value instanceof Buffer) { return true; }
  return false;
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

const scanForDangerousValues = (
  obj: unknown,
  scan: ScanContext,
  path = '',
  isTopLevel = true
): string[] => {
  const dangerous: string[] = [];

  if (!obj || typeof obj !== 'object' || scan.seen.has(obj as object)) {
    return dangerous;
  }
  scan.seen.add(obj as object);

  for (const key of keys(obj as Record<string, unknown>)) {
    let currentPath: string;
    if (path) {
      currentPath = `${path}.${key}`;
    } else {
      currentPath = key;
    }
    const value = (obj as Record<string, unknown>)[key];

    // Prototype pollution keys - check at ALL levels (nested + top-level)
    if (isPrototypePollutionKey(key) || isBlockedNestedContextKey(key)) {
      dangerous.push(currentPath);
    }
    // Dangerous globals - check ONLY at top-level
    else if (isTopLevel && isDangerousGlobal(key)) {
      dangerous.push(currentPath);
    }

    if (isFunction(value)) {
      const fnName = value.name || key;
      // eval/Function - only dangerous at top-level (nested user.eval is not the global eval)
      if (isTopLevel && (fnName === 'eval' || fnName === 'Function')) {
        dangerous.push(currentPath);
      }
      // Other dangerous globals - only dangerous at top-level
      if (isTopLevel && isDangerousGlobal(fnName)) {
        dangerous.push(currentPath);
      }
      // Non-builtin non-global functions at top-level
      if (isTopLevel && scan.allowedGlobals && !scan.allowedGlobals.includes(fnName) && !isBuiltIn(fnName)) {
        dangerous.push(currentPath);
      }
    }

    if (isDangerousReference(value)) {
      dangerous.push(currentPath);
    }

    if (value && typeof value === 'object' && !isDangerousReference(value)) {
      dangerous.push(...scanForDangerousValues(value, scan, currentPath, false));
    }
  }

  return dangerous;
};

/** Public entry: starts a fresh scan with its own cycle-tracking set. */
const findDangerousValues = (obj: unknown, allowedGlobals?: readonly string[] | null): string[] =>
  scanForDangerousValues(obj, { allowedGlobals, seen: new WeakSet() });

const scrubDangerousReferences = <T>(context: T, _allowedGlobals: readonly string[] | null): T => {
  const seen = new WeakSet<object>();
  const visit = <V>(value: V): V => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) { return value; }
    seen.add(value as object);
    const record = value as Record<string, unknown>;
    for (const key of keys(record)) {
      const child = record[key];
      if (isDangerousReference(child)) {
        delete record[key];
      } else if (child && typeof child === 'object') {
        visit(child);
      }
    }
    return value;
  };
  return visit(context);
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

  const contextKeys = keys(context);
  const blocked: BlockedKeyResult[] = [];

  for (const key of contextKeys) {
    if (isBlockedKey(key)) {
      blocked.push({ key, reason: 'blocked key' });
    } else if (allowedKeys && !allowedKeys.includes(key)) {
      blocked.push({ key, reason: 'not in allowed keys' });
    } else if (blockedKeys?.includes(key)) {
      blocked.push({ key, reason: 'in blocked keys list' });
    }
  }

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
      `Cannot use blocked keys in context: ${keyValidation.blocked.map(b => b.key).join(', ')}`,
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
  const restricted: Record<string, unknown> = {};

  for (const key of keys(context)) {
    if (isDangerousGlobal(key) && !allowed.has(key)) {
      // skip blocked globals unless explicitly allowed
    } else {
      restricted[key] = context[key];
    }
  }

  return restricted;
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
      let effectiveAllowedGlobals: readonly string[] | null;
      if (strictMode) {
        effectiveAllowedGlobals = [];
      } else {
        effectiveAllowedGlobals = allowedGlobals;
      }
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
          `Template contains unsafe code: ${violations.map(v => v.message).join('; ')}`,
          'DANGEROUS_TEMPLATE_CODE'
        );
      }
      return violations;
    },

    options
  };
};

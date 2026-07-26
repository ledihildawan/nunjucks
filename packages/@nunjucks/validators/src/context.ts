import process from "node:process";
interface SecurityError extends Error {
  code: string;
  dangerousPaths?: string[];
}

interface ContextValidationError {
  code: string;
  message: string;
  subject?: string;
  dangerousPaths?: string[];
}

interface ContextValidationResult {
  valid: boolean;
  errors: ContextValidationError[];
}

interface ContextValidatorConfig {
  strictMode?: boolean;
  scanContextValues?: boolean;
  allowedContextKeys?: readonly string[];
  blockedContextKeys?: readonly string[];
  allowedGlobals?: readonly string[];
}

const DANGEROUS_GLOBALS = new Set([
  'process', 'global', 'globalThis', 'window', 'document', 'self', 'console',
  'Buffer', 'exports', 'module', 'require', '__dirname', '__filename'
]);

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__', 'constructor', 'prototype', 'hasOwnProperty'
]);

const globalRecord = globalThis as Record<string, unknown>;

const isDangerousValue = (value: unknown): boolean => {
  if (value === null || value === undefined) { return false; }
  if (typeof value === 'object' || typeof value === 'function') {
    if (typeof process !== 'undefined' && value === process) { return true; }
    if (value === globalThis) { return true; }
    if (globalRecord.window !== undefined && value === globalRecord.window) { return true; }
    if (globalRecord.document !== undefined && value === globalRecord.document) { return true; }
    if (globalRecord.self !== undefined && value === globalRecord.self) { return true; }
    if (typeof Buffer !== 'undefined' && value instanceof Buffer) { return true; }
    if (typeof globalThis !== 'undefined' && value === globalThis) { return true; }
  }
  return false;
};

/**
 * Paths contributed by a single key. A prototype-pollution key is reported on
 * its own and short-circuits the remaining checks.
 */
const dangerousPathsForKey = (
  key: string,
  value: unknown,
  currentPath: string,
  allowedGlobals: readonly string[] | null | undefined,
  isTopLevel: boolean
): string[] => {
  if (PROTOTYPE_POLLUTION_KEYS.has(key)) { return [currentPath]; }

  const found: string[] = [];
  if (isTopLevel && DANGEROUS_GLOBALS.has(key) && !allowedGlobals?.includes(key)) {
    found.push(currentPath);
  }
  if (typeof value === 'function') {
    const fnName = value.name || key;
    if (isTopLevel && (fnName === 'eval' || fnName === 'Function')) {
      found.push(currentPath);
    }
    if (isTopLevel && DANGEROUS_GLOBALS.has(fnName) && !allowedGlobals?.includes(fnName)) {
      found.push(currentPath);
    }
  }
  if (isDangerousValue(value)) {
    found.push(currentPath);
  }
  return found;
};

const findDangerousValues = (
  obj: unknown,
  allowedGlobals?: readonly string[] | null,
  path = '',
  isTopLevel = true,
  seen: WeakSet<object> = new WeakSet()
): string[] => {
  const dangerous: string[] = [];

  if (!obj || typeof obj !== 'object' || seen.has(obj as object)) {
    return dangerous;
  }
  seen.add(obj as object);

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    let currentPath: string;
    if (path) {
      currentPath = `${path}.${key}`;
    } else {
      currentPath = key;
    }
    const value = record[key];

    dangerous.push(...dangerousPathsForKey(key, value, currentPath, allowedGlobals, isTopLevel));

    // Never descend into a prototype-pollution key.
    const descend = !PROTOTYPE_POLLUTION_KEYS.has(key) &&
      value && typeof value === 'object' && !isDangerousValue(value);
    if (descend) {
      dangerous.push(...findDangerousValues(value, allowedGlobals, currentPath, false, seen));
    }
  }

  return dangerous;
};

const validateRenderContext = (context: unknown, config: ContextValidatorConfig): ContextValidationResult => {
  if (!(config.strictMode || config.scanContextValues)) {
    return { valid: true, errors: [] };
  }

  try {
    if (config.strictMode || config.scanContextValues) {
      const dangerous = findDangerousValues(context, config.allowedGlobals);
      if (dangerous.length > 0) {
        const err: SecurityError = new Error(`Context contains unsafe values: ${dangerous.join(', ')}`) as SecurityError;
        err.code = 'DANGEROUS_CONTEXT_VALUES';
        err.dangerousPaths = dangerous;
        throw err;
      }
    }
    return { valid: true, errors: [] };
  } catch (err) {
    const securityError = err as SecurityError;
    const errorObj: ContextValidationResult = {
      valid: false,
      errors: [{
        code: securityError.code || 'SECURITY_VIOLATION',
        message: securityError.message
      }]
    };
    if (securityError.dangerousPaths) {
      const firstError = errorObj.errors[0] as NonNullable<typeof errorObj.errors[0]>;
      firstError.subject = securityError.dangerousPaths[0];
      firstError.dangerousPaths = securityError.dangerousPaths;
    }
    return errorObj;
  }
};

const findContextDangerousValues = (context: unknown, config: { allowedGlobals?: readonly string[] } = {}): string[] => {
  if (!context || typeof context !== 'object') { return []; }
  return findDangerousValues(context, config.allowedGlobals);
};

export { validateRenderContext, findContextDangerousValues };
export type { ContextValidationError, ContextValidationResult, ContextValidatorConfig };

import { keys, isFunction, pipe, map, join } from 'remeda';
import { isBlockedKey, isDangerousGlobal } from '@nunjucks/shared/blocked-keys';
import { scanTemplateForDangerousCode, type DangerousCodeViolation, isDangerousReference, findDangerousValues } from '@nunjucks/shared';

export { scanTemplateForDangerousCode };
export type { DangerousCodeViolation };

const isObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

interface BlockedKeyResult {
  key: string;
  reason: string;
}

interface ValidateContextKeysResult {
  valid: boolean;
  blocked: BlockedKeyResult[];
}

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

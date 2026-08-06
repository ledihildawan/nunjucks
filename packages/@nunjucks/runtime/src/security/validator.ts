import { keys, isFunction, pipe, map, join } from 'remeda';
import { findDangerousValues, isBlockedKey, isDangerousGlobal, isObject, scanTemplateForDangerousCode, type DangerousCodeViolation } from '@nunjucks/shared';
import { createSecurityError } from './error.ts';
import { scrubDangerousReferences } from './scrubber.ts';

interface BlockedKeyResult {
  key: string;
  reason: string;
}

interface ValidateContextKeysResult {
  valid: boolean;
  blocked: BlockedKeyResult[];
}

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

export const restrictGlobals = (
  context: Record<string, unknown>,
  allowedGlobals: readonly string[] = []
): Record<string, unknown> => {
  const allowed = new Set(allowedGlobals);
  return Object.fromEntries(
    keys(context)
      .filter(key => !(isDangerousGlobal(key) && !allowed.has(key)))
      .map(key => [key, context[key]])
  );
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

export type { BlockedKeyResult, ValidateContextKeysResult };
export { scrubDangerousReferences };

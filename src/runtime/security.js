import { keys, isFunction } from 'remeda';
import { isBlockedKey, isDangerousGlobal } from '../shared/blocked-keys.js';

const isObject = (val) => val !== null && typeof val === 'object' && !Array.isArray(val);

export class SecurityError extends Error {
  constructor(message, code = 'SECURITY_VIOLATION') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
  { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
  { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
  { pattern: /\bimport\s+\(/, message: 'dynamic import() is not allowed' },
];

export const scanTemplateForDangerousCode = (templateContent) => {
  const violations = [];

  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(templateContent)) {
      violations.push({ message, pattern: pattern.source });
    }
  }

  return violations;
};

export const validateContextKeys = (context, allowedKeys = null, blockedKeys = null) => {
  if (!isObject(context) || isFunction(context)) {
    return { valid: true, blocked: [] };
  }

  const contextKeys = keys(context);
  const blocked = [];

  for (const key of contextKeys) {
    if (isBlockedKey(key)) {
      blocked.push({ key, reason: 'blocked key' });
      continue;
    }

    if (allowedKeys && !allowedKeys.includes(key)) {
      blocked.push({ key, reason: 'not in allowed keys' });
      continue;
    }

    if (blockedKeys && blockedKeys.includes(key)) {
      blocked.push({ key, reason: 'in blocked keys list' });
      continue;
    }
  }

  return {
    valid: blocked.length === 0,
    blocked
  };
};

export const validateContext = (context, options = {}) => {
  const {
    allowedKeys = null,
    blockedKeys = null,
    allowedGlobals = null,
    scanValues = false
  } = options;

  const keyValidation = validateContextKeys(context, allowedKeys, blockedKeys);
  if (!keyValidation.valid) {
    throw new SecurityError(
      `Context contains blocked keys: ${keyValidation.blocked.map(b => b.key).join(', ')}`,
      'BLOCKED_CONTEXT_KEYS'
    );
  }

  if (scanValues) {
    const dangerousValues = findDangerousValues(context, allowedGlobals);
    if (dangerousValues.length > 0) {
      throw new SecurityError(
        `Context contains dangerous values: ${dangerousValues.join(', ')}`,
        'DANGEROUS_CONTEXT_VALUES'
      );
    }
  }

  return true;
};

const findDangerousValues = (obj, allowedGlobals, path = '') => {
  const dangerous = [];

  if (!obj || typeof obj !== 'object') {
    return dangerous;
  }

  for (const key of keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const value = obj[key];

    if (isFunction(value)) {
      const fnName = value.name || key;
      if (isDangerousGlobal(fnName) || fnName === 'eval' || fnName === 'Function') {
        dangerous.push(currentPath);
      }

      if (allowedGlobals && !allowedGlobals.includes(fnName) && !isBuiltIn(fnName)) {
        dangerous.push(currentPath);
      }
    }

    if (value && typeof value === 'object') {
      dangerous.push(...findDangerousValues(value, allowedGlobals, currentPath));
    }
  }

  return dangerous;
};

const BUILTIN_GLOBALS = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError'
]);

const isBuiltIn = (name) => BUILTIN_GLOBALS.has(name);

export const restrictGlobals = (context, allowedGlobals = []) => {
  const allowed = new Set(allowedGlobals);
  const restricted = {};

  for (const key of keys(context)) {
    if (isDangerousGlobal(key) && !allowed.has(key)) {
      continue;
    }
    restricted[key] = context[key];
  }

  return restricted;
};

export const createSecurityValidator = (options = {}) => {
  const {
    allowedKeys = null,
    blockedKeys = null,
    allowedGlobals = null,
    scanValues = false,
    strictMode = false
  } = options;

  return {
    validateContext: (context) => validateContext(context, {
      allowedKeys,
      blockedKeys,
      allowedGlobals: strictMode ? [] : allowedGlobals,
      scanValues: strictMode || scanValues
    }),

    scanTemplate: (content) => {
      const violations = scanTemplateForDangerousCode(content);
      if (violations.length > 0 && strictMode) {
        throw new SecurityError(
          `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
          'DANGEROUS_TEMPLATE_CODE'
        );
      }
      return violations;
    },

    options
  };
};

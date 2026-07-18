import { keys, isFunction } from 'remeda';
import { isBlockedKey, isDangerousGlobal } from '@nunjucks/shared/blocked-keys';

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

const getLineColFromIndex = (content, index) => {
  const beforeMatch = content.slice(0, index);
  const lines = beforeMatch.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
};

export const scanTemplateForDangerousCode = (templateContent) => {
  const violations = [];

  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(templateContent)) !== null) {
      const { line, col } = getLineColFromIndex(templateContent, match.index);
      violations.push({ message, pattern: pattern.source, line, col });
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
    const err = new SecurityError(
      `Cannot use blocked keys in context: ${keyValidation.blocked.map(b => b.key).join(', ')}`,
      'BLOCKED_CONTEXT_KEYS'
    );
    err.dangerousPaths = keyValidation.blocked.map(b => b.key);
    throw err;
  }

  if (scanValues) {
    const dangerousValues = findDangerousValues(context, allowedGlobals);
    if (dangerousValues.length > 0) {
      const err = new SecurityError(
        `Context contains unsafe values: ${dangerousValues.join(', ')}`,
        'DANGEROUS_CONTEXT_VALUES'
      );
      err.dangerousPaths = dangerousValues;
      throw err;
    }
  }

  return true;
};

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf'
]);

const isPrototypePollutionKey = (key) => PROTOTYPE_POLLUTION_KEYS.has(key);

const findDangerousValues = (obj, allowedGlobals, path = '', isTopLevel = true) => {
  const dangerous = [];

  if (!obj || typeof obj !== 'object') {
    return dangerous;
  }

  for (const key of keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const value = obj[key];

    // Prototype pollution keys - check at ALL levels (nested + top-level)
    if (isPrototypePollutionKey(key)) {
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
      if (isTopLevel && allowedGlobals && !allowedGlobals.includes(fnName) && !isBuiltIn(fnName)) {
        dangerous.push(currentPath);
      }
    }

    if (value && typeof value === 'object') {
      dangerous.push(...findDangerousValues(value, allowedGlobals, currentPath, false));
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
          `Template contains unsafe code: ${violations.map(v => v.message).join('; ')}`,
          'DANGEROUS_TEMPLATE_CODE'
        );
      }
      return violations;
    },

    options
  };
};

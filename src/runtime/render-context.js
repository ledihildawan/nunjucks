// ============================================
// Section 1: Internal Scope Functions
// ============================================
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { entries, fromEntries, forEachObj } from 'remeda';

const createScope = (data = {}, parent = null) => ({
  data: new Map(entries(data)),
  parent
});

const scopeGet = (scope, key) => {
  let current = scope;
  while (current) {
    const val = current.data.get(key);
    if (val !== undefined) return [null, val];
    current = current.parent;
  }
  return [createLog('error', ERROR_DEFINITIONS.KEY_NOT_FOUND, { key }, key, { phase: 'render' })];
};

const scopeSet = (scope, key, value) => ({
  ...scope,
  data: new Map(scope.data).set(key, value)
});

const scopeHas = (scope, key) => {
  let current = scope;
  while (current) {
    if (current.data.has(key)) return true;
    current = current.parent;
  }
  return false;
};

const scopeKeys = (scope) => {
  const keys = new Set();
  let current = scope;
  while (current) {
    for (const k of current.data.keys()) {
      keys.add(k);
    }
    current = current.parent;
  }
  return keys;
};

// ============================================
// Section 2: Main Export
// ============================================

export const createRenderContext = (initialData = {}) => {
  let currentScope = createScope(initialData);
  let cachedToObject = null;
  let cachedToObjectScope = null;

  const context = {
    get: (key) => {
      let current = currentScope;
      while (current) {
        const val = current.data.get(key);
        if (val !== undefined) return val;
        current = current.parent;
      }
      return undefined;
    },

    set: (key, value) => {
      currentScope = scopeSet(currentScope, key, value);
      cachedToObject = null;
      return context;
    },

    has: (key) => scopeHas(currentScope, key),

    delete: (key) => {
      const newData = new Map(currentScope.data);
      newData.delete(key);
      currentScope = { ...currentScope, data: newData };
      cachedToObject = null;
      return context;
    },

    fork: (data = {}) => {
      currentScope = createScope(data, currentScope);
      cachedToObject = null;
      return context;
    },

    merge: (data = {}) => {
      for (const [k, v] of Object.entries(data)) {
        currentScope = scopeSet(currentScope, k, v);
      }
      cachedToObject = null;
      return context;
    },

    toObject: () => {
      if (cachedToObject && cachedToObjectScope === currentScope) {
        return cachedToObject;
      }
      const result = {};
      let current = currentScope;
      const seen = new Set();
      while (current) {
        for (const [k, v] of current.data) {
          if (!seen.has(k)) {
            seen.add(k);
            result[k] = v;
          }
        }
        current = current.parent;
      }
      cachedToObject = result;
      cachedToObjectScope = currentScope;
      return result;
    },

    clone: () => createRenderContext(context.toObject()),

    _debug: () => ({
      current: fromEntries(currentScope.data),
      parent: currentScope.parent
        ? fromEntries(currentScope.parent.data)
        : null
    })
  };

  return context;
};

// Shortcut
export const ctx = createRenderContext;

// ============================================
// Section 3: Composable Helpers
// ============================================

export const withDefaults = (defaults) => (context) => {
  const newCtx = context.clone();
  for (const [k, v] of Object.entries(defaults)) {
    if (newCtx.get(k) === undefined) {
      newCtx.set(k, v);
    }
  }
  return newCtx;
};

export const withComputed = (computations) => (context) => {
  const newCtx = context.clone();
  for (const [k, computeFn] of Object.entries(computations)) {
    newCtx.set(k, computeFn(newCtx));
  }
  return newCtx;
};

export const withValidation = (validators) => (context) => {
  const newCtx = context.clone();
  const originalSet = newCtx.set;
  newCtx.set = (key, value) => {
    if (validators[key] && !validators[key](value)) {
      throw createLog('error', ERROR_DEFINITIONS.VALIDATION_ERROR, { key }, key, { phase: 'render' });
    }
    return originalSet(key, value);
  };
  return newCtx;
};

export const traceContext = (context, label = 'Context') => {
  console.log(`[${label}]`, context._debug());
  return context;
};

// ============================================
// Section 4: Integration Helpers
// ============================================

export const toContext = (obj) => {
  if (obj && typeof obj.get === 'function') {
    return obj;
  }
  return createRenderContext(obj || {});
};

export const createIsolatedContext = () => createRenderContext({});

export const createForkedContext = (parentCtx, data = {}) => {
  const newCtx = parentCtx.clone();
  newCtx.merge(data);
  return newCtx;
};

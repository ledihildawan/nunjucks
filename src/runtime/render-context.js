// ============================================
// Section 1: Internal Scope Functions
// ============================================
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

const createScope = (data = {}, parent = null) => ({
  data: new Map(Object.entries(data)),
  parent
});

const scopeGet = (scope, key) => {
  if (scope.data.has(key)) return [null, scope.data.get(key)];
  if (scope.parent) return scopeGet(scope.parent, key);
  return [createLog('error', ERROR_DEFINITIONS.KEY_NOT_FOUND, { key }, key, { phase: 'render' })];
};

const scopeSet = (scope, key, value) => ({
  ...scope,
  data: new Map(scope.data).set(key, value)
});

const scopeHas = (scope, key) =>
  scope.data.has(key) || (scope.parent ? scopeHas(scope.parent, key) : false);

const scopeKeys = (scope) => {
  const keys = scope.parent ? scopeKeys(scope.parent) : [];
  for (const k of scope.data.keys()) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
};

// ============================================
// Section 2: Main Export
// ============================================

export const createRenderContext = (initialData = {}) => {
  let currentScope = createScope(initialData);

  const context = {
    get: (key) => {
      const [err, value] = scopeGet(currentScope, key);
      return err ? undefined : value;
    },

    set: (key, value) => {
      currentScope = scopeSet(currentScope, key, value);
      return context;
    },

    has: (key) => scopeHas(currentScope, key),

    delete: (key) => {
      const newData = new Map(currentScope.data);
      newData.delete(key);
      currentScope = {
        ...currentScope,
        data: newData
      };
      return context;
    },

    fork: (data = {}) => {
      currentScope = createScope(data, currentScope);
      return context;
    },

    merge: (data = {}) => {
      for (const [k, v] of Object.entries(data)) {
        currentScope = scopeSet(currentScope, k, v);
      }
      return context;
    },

    toObject: () => {
      const result = {};
      const keys = scopeKeys(currentScope);
      for (const k of keys) {
        const [err, value] = scopeGet(currentScope, k);
        if (!err) result[k] = value;
      }
      return result;
    },

    clone: () => createRenderContext(context.toObject()),

    _debug: () => ({
      current: Object.fromEntries(currentScope.data),
      parent: currentScope.parent
        ? Object.fromEntries(currentScope.parent.data)
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

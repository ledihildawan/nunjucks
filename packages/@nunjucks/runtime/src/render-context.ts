// RENDER CONTEXT - Scoped render context with composables
import { pipe, entries, reduce, forEach } from 'remeda';
import { ERROR_DEFINITIONS, createLog } from '@nunjucks/log';

const createScope = (data: Record<string, unknown> = {}, parent: Scope | null = null): Scope => ({
  data: new Map(Object.entries(data)),
  parent,
});

interface Scope {
  data: Map<string, unknown>;
  parent: Scope | null;
}

const scopeSet = (scope: Scope, key: string, value: unknown): Scope => ({
  ...scope,
  data: new Map(scope.data).set(key, value),
});

const scopeHas = (scope: Scope, key: string): boolean =>
  scope.data.has(key) || (scope.parent !== null && scopeHas(scope.parent, key));

const scopeGet = (scope: Scope | null, key: string): unknown => {
  if (!scope) { return undefined; }
  const val = scope.data.get(key);
  return val !== undefined ? val : scopeGet(scope.parent, key);
};

const mergeScopeData = (scope: Scope, seen: Set<string>, result: Record<string, unknown>): void => {
  scope.data.forEach((v, k) => {
    if (!seen.has(k)) {
      seen.add(k);
      result[k] = v;
    }
  });
};

export interface RenderContext {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => RenderContext;
  has: (key: string) => boolean;
  delete: (key: string) => RenderContext;
  fork: (data?: Record<string, unknown>) => RenderContext;
  merge: (data?: Record<string, unknown>) => RenderContext;
  toObject: () => Record<string, unknown>;
  clone: () => RenderContext;
  _debug?: () => unknown;
}

export const createRenderContext = (initialData: Record<string, unknown> = {}): RenderContext => {
  let currentScope = createScope(initialData);
  let cachedToObject: Record<string, unknown> | null = null;
  let cachedToObjectScope: Scope | null = null;

  const invalidateCache = () => {
    cachedToObject = null;
    cachedToObjectScope = null;
  };

  const context: RenderContext = {
    get: (key: string): unknown => scopeGet(currentScope, key),

    set: (key: string, value: unknown): RenderContext => {
      currentScope = scopeSet(currentScope, key, value);
      invalidateCache();
      return context;
    },

    has: (key: string): boolean => scopeHas(currentScope, key),

    delete: (key: string): RenderContext => {
      const newData = new Map(currentScope.data);
      newData.delete(key);
      currentScope = { ...currentScope, data: newData };
      invalidateCache();
      return context;
    },

    fork: (data: Record<string, unknown> = {}): RenderContext => {
      currentScope = createScope(data, currentScope);
      invalidateCache();
      return context;
    },

    merge: (data: Record<string, unknown> = {}): RenderContext => {
      currentScope = pipe(
        data,
        entries(),
        reduce((scope, [k, v]) => scopeSet(scope, k, v), currentScope)
      );
      invalidateCache();
      return context;
    },

    toObject: (): Record<string, unknown> => {
      if (cachedToObject && cachedToObjectScope === currentScope) {
        return cachedToObject;
      }
      const result: Record<string, unknown> = {};
      const seen = new Set<string>();
      let current: Scope | null = currentScope;
      while (current) {
        mergeScopeData(current, seen, result);
        current = current.parent;
      }
      cachedToObject = result;
      cachedToObjectScope = currentScope;
      return result;
    },

    clone: (): RenderContext => createRenderContext(context.toObject()),
  };

  return context;
};

export const ctx = createRenderContext;

export const withDefaults = (defaults: Record<string, unknown>) => (context: RenderContext): RenderContext => {
  const newCtx = context.clone();
  pipe(defaults, entries(), forEach(([k, v]) => {
    if (newCtx.get(k) === undefined) {
      newCtx.set(k, v);
    }
  }));
  return newCtx;
};

export const withComputed = (computations: Record<string, (c: RenderContext) => unknown>) => (context: RenderContext): RenderContext => {
  const newCtx = context.clone();
  pipe(computations, entries(), forEach(([k, computeFn]) => {
    newCtx.set(k, computeFn(newCtx));
  }));
  return newCtx;
};

export const withValidation = (validators: Record<string, (v: unknown) => boolean>) => (context: RenderContext): RenderContext => {
  const newCtx = context.clone();
  const originalSet = newCtx.set;
  newCtx.set = (key: string, value: unknown): RenderContext => {
    if (validators[key] && !validators[key](value)) {
      throw createLog('error', ERROR_DEFINITIONS.VALIDATION_ERROR, { key }, key, { phase: 'render' });
    }
    return originalSet(key, value);
  };
  return newCtx;
};

export const traceContext = (context: RenderContext, _label = 'Context'): RenderContext => context;

export const toContext = (obj: unknown): RenderContext => {
  if (obj && typeof (obj as { get?: unknown }).get === 'function') {
    return obj as RenderContext;
  }
  return createRenderContext((obj as Record<string, unknown>) || {});
};

export const createIsolatedContext = (): RenderContext => createRenderContext({});

export const createForkedContext = (parentCtx: RenderContext, data: Record<string, unknown> = {}): RenderContext => {
  const newCtx = parentCtx.clone();
  newCtx.merge(data);
  return newCtx;
};

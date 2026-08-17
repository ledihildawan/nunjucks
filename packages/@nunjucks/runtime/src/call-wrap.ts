import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { isArray, isKeyedObject, isPlainObject, isString } from '@nunjucks/lib';
import { throwRuntimeError } from './error-context.ts';
import { getNullParentName, isNullAccessResult } from './member-access.ts';

// WHY: only `super` is reserved at call sites today — callWrap names that trip this set
// throw RESERVED_KEYWORD_CONTEXT with the caller-supplied subject.
const RESERVED_KEYWORD_CONTEXT_NAMES = new Set(['super']);

/**
 * Call-site metadata for `callWrap`: the display name used in errors, the
 * invocation's receiver and argument list, and its source position.
 */
export interface CallWrapOptions {
  displayName: string | null;
  context: unknown;
  args: unknown[];
  lineno?: number;
  colno?: number;
}

/**
 * Invokes `target.name(...args)` on generated code's behalf, throwing for
 * reserved context names (`super`), null receivers (raw values or null-access
 * sentinels), and non-function targets; `Reflect.apply` keeps null-prototype
 * callables invocable, and `this` is an unknown pass-through for enrichment.
 */
function callWrap(this: unknown, target: unknown, name: string, options: CallWrapOptions): unknown {
  const { displayName, context, args, lineno, colno } = options;
  const messageName = displayName ?? name;
  if (RESERVED_KEYWORD_CONTEXT_NAMES.has(name)) {
    throwRuntimeError(ERROR_DEFINITIONS.RESERVED_KEYWORD_CONTEXT, {
      runtimeContext: this,
      lineno,
      colno,
      params: { name },
      subject: name,
    });
  }

  // WHY: two null-check paths — isNullAccessResult catches sentinel objects from memberLookup (carries parent name); !target catches raw null/undefined. Both throw NULL_VALUE with the best available parent name.
  const parentName = isNullAccessResult(target) ? (getNullParentName(target) ?? name) : null;
  if (isNullAccessResult(target) || !target) {
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      runtimeContext: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: parentName ?? name },
      subject: name,
    });
  }

  if (typeof target === 'function') {
    // WHY: Reflect.apply — miss-sentinel callables carry a null prototype (no .apply
    // method); the reflect form invokes them like any other function.
    return Reflect.apply(target, context, args);
  }
  throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
    runtimeContext: this,
    lineno,
    colno,
    params: { name: messageName, type: typeof target },
    subject: name,
  });
}

/** Options for the `in` operator: the key, the container, and the source position. */
export interface InOperatorOptions {
  key: unknown;
  value: unknown;
  lineno?: number | null;
  colno?: number | null;
}

/**
 * Implements template `in` checks: membership for arrays and strings and
 * own-property presence for plain objects — mirroring `memberLookup`'s
 * not-found semantics instead of the JS `in` operator's prototype-chain walk.
 */
function inOperator(
  this: unknown,
  { key, value, lineno = null, colno = null }: InOperatorOptions
): boolean {
  if (isArray(value)) {
    return value.includes(key);
  }
  if (isString(value)) {
    return value.includes(String(key));
  }
  if (isPlainObject(value)) {
    // WHY: own-property semantics — mirrors memberLookup, which treats inherited prototype keys
    // ('constructor', 'toString', …) as not-found; the JS `in` operator would walk the prototype
    // chain and answer true for `'constructor' in {}`, contradicting member access.
    return isKeyedObject(value) && Object.hasOwn(value, String(key));
  }
  return throwRuntimeError(ERROR_DEFINITIONS.IN_OPERATOR, {
    runtimeContext: this,
    lineno,
    colno,
    params: { key: String(key), type: typeof value },
    subject: String(key),
  });
}

export { callWrap, inOperator };

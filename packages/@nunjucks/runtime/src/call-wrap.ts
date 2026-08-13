import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { isArray, isKeyedObject, isPlainObject, isString } from '@nunjucks/lib';
import {
  getNullParentName,
  isNullAccessResult,
} from './member-access.ts';
import {
  throwRuntimeError,
} from './error-context.ts';

const RESERVED_KEYWORD_CONTEXTS: Record<string, string> = {
  super: 'block that extends a parent template',
};

export interface CallWrapOptions {
  displayName: string | null;
  context: unknown;
  args: unknown[];
  lineno?: number;
  colno?: number;
}

function callWrap(
  this: unknown,
  target: unknown,
  name: string,
  options: CallWrapOptions,
): unknown {
  const { displayName, context, args, lineno, colno } = options;
  const messageName = displayName ?? name;
  if (RESERVED_KEYWORD_CONTEXTS[name]) {
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
    return target.apply(context, args);
  }
  throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
    runtimeContext: this,
    lineno,
    colno,
    params: { name: messageName, type: typeof target },
    subject: name,
  });
}

export interface InOperatorOptions {
  key: unknown;
  value: unknown;
  lineno?: number | null;
  colno?: number | null;
}

function inOperator(this: unknown, { key, value, lineno = null, colno = null }: InOperatorOptions): boolean {
  if (isArray(value) || isString(value)) {
    return (value as { includes: (k: unknown) => boolean }).includes(key);
  }
  if (isPlainObject(value)) {
    return isKeyedObject(value) && String(key) in value;
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

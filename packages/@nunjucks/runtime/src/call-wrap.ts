import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isArray, isKeyedObject, isPlainObject, isString } from '@nunjucks/shared';
import {
  getNullParentName,
  isNullAccessResult,
} from './member-access.ts';
import {
  throwRuntimeError,
} from './log-context.ts';

const RESERVED_KEYWORD_CONTEXTS: Record<string, string> = {
  super: 'block that extends a parent template',
};

function callWrap(
  this: unknown,
  obj: unknown,
  name: string,
  displayName: string | null,
  context: unknown,
  args: unknown[],
  lineno?: number,
  colno?: number,
): unknown {
  const messageName = displayName || name;
  if (RESERVED_KEYWORD_CONTEXTS[name]) {
    throwRuntimeError(ERROR_DEFINITIONS.RESERVED_KEYWORD_CONTEXT, {
      self: this,
      lineno,
      colno,
      params: { name },
      subject: name,
    });
  }

  if (isNullAccessResult(obj)) {
    const parentName = getNullParentName(obj) || name;
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: parentName },
      subject: name,
    });
  }

  if (!obj) {
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: name },
      subject: name,
    });
  }

  if (typeof obj === 'function') {
    return obj.apply(context, args);
  }
  throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
    self: this,
    lineno,
    colno,
    params: { name: messageName, type: typeof obj },
    subject: name,
  });
}

function inOperator(this: unknown, key: unknown, value: unknown, lineno: number | null = null, colno: number | null = null): boolean {
  if (isArray(value) || isString(value)) {
    return (value as { includes: (k: unknown) => boolean }).includes(key);
  }
  if (isPlainObject(value)) {
    return isKeyedObject(value) && String(key) in value;
  }
  return throwRuntimeError(ERROR_DEFINITIONS.IN_OPERATOR, {
    self: this,
    lineno,
    colno,
    params: { key: String(key), type: typeof value },
    subject: String(key),
  });
}

export { callWrap, inOperator };

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
      self: this,
      lineno,
      colno,
      params: { name },
      subject: name,
    });
  }

  if (isNullAccessResult(target)) {
    const parentName = getNullParentName(target) ?? name;
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: parentName },
      subject: name,
    });
  }

  if (!target) {
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: name },
      subject: name,
    });
  }

  if (typeof target === 'function') {
    return target.apply(context, args);
  }
  throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
    self: this,
    lineno,
    colno,
    params: { name: messageName, type: typeof target },
    subject: name,
  });
}

export interface InOperatorOptions {
  lineno?: number | null;
  colno?: number | null;
}

function inOperator(this: unknown, key: unknown, value: unknown, options: InOperatorOptions = {}): boolean {
  const { lineno = null, colno = null } = options;
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

// SAFE STRING - Marks strings as already escaped for autoescape handling
export interface SafeString extends String {
  val: string;
  length: number;
  valueOf(): string;
  toString(): string;
}

export function createSafeString(val: unknown): unknown {
  if (typeof val !== 'string') {
    return val;
  }

  return Object.create(String.prototype, {
    val: { value: val },
    length: { value: val.length },
    valueOf: { value: () => val },
    toString: { value: () => val },
  });
}

export function isSafeString(val: unknown): boolean {
  return !!val && (val as { val?: unknown }).val !== undefined;
}

export function copySafeness(dest: unknown, target: { toString(): string }): unknown {
  if (dest && (dest as { val?: unknown }).val !== undefined) {
    return createSafeString(target);
  }
  return target.toString();
}

export function markSafe(val: unknown): unknown {
  const type = typeof val;

  if (type === 'string') {
    return createSafeString(val);
  } else if (type !== 'function') {
    return val;
  } else {
    const fn = val as (...args: unknown[]) => unknown;
    return function wrapSafe(this: unknown, ...args: unknown[]): unknown {
      const ret = fn.apply(this, args);
      if (typeof ret === 'string') {
        return createSafeString(ret);
      }
      return ret;
    };
  }
}

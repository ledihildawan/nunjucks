import { keys } from 'remeda';

/** Renders a primitive for ANSI display, quoting strings and naming functions. */
export const sanitizePrimitive = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
};

/**
 * Renders a context value for ANSI display without ever expanding objects: primitives go
 * through `sanitizePrimitive`, arrays collapse to `Array(n)`, objects to `Object(n)`, and
 * re-visited objects degrade to `[Circular]`.
 */
export const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizePrimitive(value);
  }
  if (seen?.has(value)) {
    return '[Circular]';
  }
  const newSeen = seen ?? new WeakSet();
  newSeen.add(value);
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  return `Object(${keys(value).length})`;
};

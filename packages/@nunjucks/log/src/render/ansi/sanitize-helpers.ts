import { keys } from 'remeda';

export { sanitizePrimitive, sanitizeForAnsi };

const sanitizePrimitive = (value: unknown): string => {
  if (value === null) { return 'null'; }
  if (value === undefined) { return 'undefined'; }
  if (typeof value === 'function') { return `[Function: ${value.name || 'anonymous'}]`; }
  if (typeof value === 'string') { return `"${value}"`; }
  return String(value);
};

const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizePrimitive(value);
  }
  if (seen?.has(value)) { return '[Circular]'; }
  const newSeen = seen || new WeakSet();
  newSeen.add(value);
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  return `Object(${keys(value).length})`;
};

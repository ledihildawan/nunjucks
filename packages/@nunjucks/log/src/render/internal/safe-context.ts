import { getBlockedKeyCategory, isBlockedKey } from '@nunjucks/shared/blocked-keys';

const SECRET_KEY_PATTERN = /(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|authorization|cookie|session(?:[_-]?id)?|private[_-]?key)/i;
const DANGEROUS_KEY_PATTERN = /^(?:globalThis|process|window|parent|top|frames|opener)$/i;
const DEFAULT_OPTIONS = Object.freeze({ maxDepth: 8, maxEntries: 50, maxStringLength: 1024, maxTotalLength: 65536 });

interface TruncateState {
  maxTotalLength: number;
  totalLength: number;
  maxStringLength: number;
}

interface NormalizeState extends TruncateState {
  maxDepth: number;
  maxEntries: number;
}

const truncate = (value: string, state: TruncateState): string => {
  const remaining = state.maxTotalLength - state.totalLength;
  if (remaining <= 0) return '[Total size limit reached]';
  const max = Math.min(state.maxStringLength, remaining);
  const result = value.length > max ? `${value.slice(0, Math.max(0, max - 15))}...[Truncated]` : value;
  state.totalLength += result.length;
  return result;
};

const visibleKey = (key: string, depth: number): boolean => {
  if (key.startsWith('__nunjucks')) return false;
  if (getBlockedKeyCategory(key) === 'object_intrinsic') return false;
  return depth > 0 || !isBlockedKey(key);
};

const ownEnumerableKeys = (value: unknown): string[] => {
  if (typeof value !== 'object' || value === null) return [];
  try {
    return Reflect.ownKeys(value).filter((key): key is string => {
      if (typeof key !== 'string') return false;
      try {
        return Object.getOwnPropertyDescriptor(value, key)?.enumerable === true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};

const readOwnValue = (value: object, key: string | symbol): unknown => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return '[Unavailable]';
    if ('get' in descriptor || 'set' in descriptor) return '[Accessor omitted]';
    return descriptor.value;
  } catch {
    return '[Unavailable]';
  }
};

const normalizeValue = (value: unknown, state: NormalizeState, depth: number, seen: WeakSet<object>): unknown => {
  if (value === undefined) return '[Undefined]';
  if (value === null) return null;
  if (typeof value === 'string') return truncate(value, state);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return truncate(String(value), state);
  if (typeof value === 'function') return `[Function${value.name ? `: ${value.name}` : ''}]`;
  if (typeof value !== 'object') return truncate(String(value), state);
  if (seen.has(value)) return '[Circular]';
  if (depth >= state.maxDepth) return '[Max depth reached]';

  seen.add(value);
  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '[Invalid Date]' : value.toISOString();
    if (value instanceof RegExp) return String(value);
    if (value instanceof Error) return { name: value.name, message: truncate(value.message, state) };
    if (value instanceof ArrayBuffer) return `[Binary: ${value.byteLength} bytes]`;
    if (ArrayBuffer.isView(value)) return `[Binary: ${value.byteLength} bytes]`;
    if (value instanceof Map) {
      const entries = [];
      let index = 0;
      for (const [key, item] of value) {
        if (index++ >= state.maxEntries) break;
        entries.push([normalizeValue(key, state, depth + 1, seen), normalizeValue(item, state, depth + 1, seen)]);
      }
      if (value.size > state.maxEntries) entries.push([`... ${value.size - state.maxEntries} more entries`, '[Truncated]']);
      return { '[Map]': entries };
    }
    if (value instanceof Set) {
      const entries = [];
      let index = 0;
      for (const item of value) {
        if (index++ >= state.maxEntries) break;
        entries.push(normalizeValue(item, state, depth + 1, seen));
      }
      if (value.size > state.maxEntries) entries.push(`[... ${value.size - state.maxEntries} more items]`);
      return { '[Set]': entries };
    }
    if (Array.isArray(value)) {
      const entries = value.slice(0, state.maxEntries).map(item => normalizeValue(item, state, depth + 1, seen));
      if (value.length > state.maxEntries) entries.push(`[... ${value.length - state.maxEntries} more items]`);
      return entries;
    }

    const result: Record<string, unknown> = {};
    const keys = ownEnumerableKeys(value).filter(key => visibleKey(key, depth));
    for (const key of keys.slice(0, state.maxEntries)) {
    result[key] = SECRET_KEY_PATTERN.test(key) || DANGEROUS_KEY_PATTERN.test(key)
      ? '[Redacted]'
      : normalizeValue(readOwnValue(value, key), state, depth + 1, seen);
    }
    if (keys.length > state.maxEntries) result['...'] = `${keys.length - state.maxEntries} more keys`;
    return result;
  } catch {
    return '[Unavailable]';
  } finally {
    seen.delete(value);
  }
};

export const normalizeRenderContext = (context: unknown, options: Partial<NormalizeState> = {}): unknown => {
  const state = { ...DEFAULT_OPTIONS, ...options, totalLength: 0 };
  return normalizeValue(context, state, 0, new WeakSet());
};

export const stringifyRenderContextValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};
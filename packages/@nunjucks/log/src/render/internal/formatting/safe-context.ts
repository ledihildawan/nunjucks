import { pipe, map, filter, reduce } from 'remeda';
import { getBlockedKeyCategory, isBlockedKey, slice } from '@nunjucks/shared';

const DANGEROUS_KEY_PATTERN = /^(?:globalThis|process|window|parent|top|frames|opener)$/iu;
const DEFAULT_OPTIONS = Object.freeze({ maxDepth: 8, maxEntries: 50, maxStringLength: 1024, maxTotalLength: 65_536 });

interface TruncateState {
  maxTotalLength: number;
  totalLength: number;
  maxStringLength: number;
}

interface NormalizeState extends TruncateState {
  maxDepth: number;
  maxEntries: number;
  blockedKeys: Set<string>;
}

const TRUNCATION_SUFFIX_BUDGET = 15;

const truncate = (value: string, state: TruncateState): string => {
  const remaining = state.maxTotalLength - state.totalLength;
  if (remaining <= 0) { return '[Total size limit reached]'; }
  const max = Math.min(state.maxStringLength, remaining);
  const result = value.length > max
    ? `${value.slice(0, Math.max(0, max - TRUNCATION_SUFFIX_BUDGET))}...[Truncated]`
    : value;
  state.totalLength += result.length;
  return result;
};

const visibleKey = (key: string, depth: number): boolean => {
  if (key.startsWith('__nunjucks')) { return false; }
  if (getBlockedKeyCategory(key) === 'object_intrinsic') { return false; }
  return depth > 0 || !isBlockedKey(key);
};

const ownEnumerableKeys = (value: unknown): string[] => {
  if (typeof value !== 'object' || value === null) { return []; }
  try {
    return pipe(
      Reflect.ownKeys(value),
      filter((key): key is string => {
        if (typeof key !== 'string') { return false; }
        try {
          return Object.getOwnPropertyDescriptor(value, key)?.enumerable === true;
        } catch {
          return false;
        }
      })
    ) as string[];
  } catch {
    return [];
  }
};

const readOwnValue = (value: object, key: string | symbol): unknown => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) { return '[Unavailable]'; }
    if ('get' in descriptor || 'set' in descriptor) { return '[Accessor omitted]'; }
    return descriptor.value;
  } catch {
    return '[Unavailable]';
  }
};

const NOT_HANDLED = Symbol('not-handled');

const formatFunction = (value: { name?: string }): string => {
  const namePart = value.name ? `: ${value.name}` : '';
  return `[Function${namePart}]`;
};

const truncateNonString = (value: unknown, state: NormalizeState): unknown =>
  typeof value === 'object' ? NOT_HANDLED : truncate(String(value), state);

const normalizePrimitive = (value: unknown, state: NormalizeState): unknown => {
  if (value === undefined) { return '[Undefined]'; }
  if (value === null) { return null; }
  if (typeof value === 'string') { return truncate(value, state); }
  if (typeof value === 'number') { return value; }
  if (typeof value === 'boolean') { return value; }
  if (typeof value === 'bigint') { return `${value}n`; }
  if (typeof value === 'symbol') { return truncate(String(value), state); }
  if (typeof value === 'function') { return formatFunction(value); }
  return truncateNonString(value, state);
};

const normalizeBuiltin = (value: object, state: NormalizeState): unknown => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) { return '[Invalid Date]'; }
    return value.toISOString();
  }
  if (value instanceof RegExp) { return String(value); }
  if (value instanceof Error) { return { name: value.name, message: truncate(value.message, state) }; }
  if (value instanceof ArrayBuffer) { return `[Binary: ${value.byteLength} bytes]`; }
  if (ArrayBuffer.isView(value)) { return `[Binary: ${value.byteLength} bytes]`; }
  return NOT_HANDLED;
};

interface NormalizeContext {
  state: NormalizeState;
  depth: number;
  seen: WeakSet<object>;
}

const overflowNote = (total: number, shown: number, unit: string): string =>
  `[... ${total - shown} more ${unit}]`;

const normalizeChildValue = (item: unknown, context: NormalizeContext): unknown =>
  normalizeValue(item, { ...context, depth: context.depth + 1 });

const normalizeMap = (value: Map<unknown, unknown>, context: NormalizeContext): unknown => {
  const { state } = context;
  const entries = pipe(
    Array.from(value),
    slice(0, state.maxEntries),
    map(([key, item]) => [normalizeChildValue(key, context), normalizeChildValue(item, context)]),
  );
  if (value.size > state.maxEntries) {
    entries.push([`... ${value.size - state.maxEntries} more entries`, '[Truncated]']);
  }
  return { '[Map]': entries };
};

const normalizeSet = (value: Set<unknown>, context: NormalizeContext): unknown => {
  const { state } = context;
  const entries = pipe(
    Array.from(value),
    slice(0, state.maxEntries),
    map((item) => normalizeChildValue(item, context)),
  );
  if (value.size > state.maxEntries) {
    entries.push(overflowNote(value.size, state.maxEntries, 'items'));
  }
  return { '[Set]': entries };
};

const normalizeArray = (value: unknown[], context: NormalizeContext): unknown => {
  const { state } = context;
  const entries = pipe(value, slice(0, state.maxEntries), map(item => normalizeChildValue(item, context)));
  if (value.length > state.maxEntries) {
    entries.push(overflowNote(value.length, state.maxEntries, 'items'));
  }
  return entries;
};

const normalizeCollection = (value: object, context: NormalizeContext): unknown => {
  if (value instanceof Map) { return normalizeMap(value, context); }
  if (value instanceof Set) { return normalizeSet(value, context); }
  if (Array.isArray(value)) { return normalizeArray(value, context); }
  return NOT_HANDLED;
};

const normalizePlainObject = (value: object, context: NormalizeContext): Record<string, unknown> => {
  const { state, depth, seen } = context;
  const visibleKeys = ownEnumerableKeys(value).filter(key => visibleKey(key, depth));
  const result = pipe(
    visibleKeys.slice(0, state.maxEntries),
    reduce((acc, key) => {
      const isBlocked = state.blockedKeys.has(key) || DANGEROUS_KEY_PATTERN.test(key);
      acc[key] = isBlocked
        ? '[Redacted]'
        : normalizeValue(readOwnValue(value, key), { state, depth: depth + 1, seen });
      return acc;
    }, {} as Record<string, unknown>),
  );
  if (visibleKeys.length > state.maxEntries) {
    result['...'] = `${visibleKeys.length - state.maxEntries} more keys`;
  }
  return result;
};

const normalizeValue = (value: unknown, context: NormalizeContext): unknown => {
  const { state, depth, seen } = context;
  const primitive = normalizePrimitive(value, state);
  if (primitive !== NOT_HANDLED) { return primitive; }

  const objectValue = value as object;
  if (seen.has(objectValue)) { return '[Circular]'; }
  if (depth >= state.maxDepth) { return '[Max depth reached]'; }

  seen.add(objectValue);
  try {
    const builtin = normalizeBuiltin(objectValue, state);
    if (builtin !== NOT_HANDLED) { return builtin; }

    const collection = normalizeCollection(objectValue, context);
    if (collection !== NOT_HANDLED) { return collection; }

    return normalizePlainObject(objectValue, context);
  } catch {
    return '[Unavailable]';
  } finally {
    seen.delete(objectValue);
  }
};

export const normalizeRenderContext = (
  context: unknown,
  options: Partial<Omit<NormalizeState, 'blockedKeys'>> & { blockedKeys?: readonly string[] | null } = {}
): unknown => {
  const blockedKeys = new Set<string>(
    (options.blockedKeys ?? []).filter((k): k is string => typeof k === 'string' && k.length > 0)
  );
  const { blockedKeys: _ignored, ...rest } = options;
  const state = { ...DEFAULT_OPTIONS, ...rest, totalLength: 0, blockedKeys };
  return normalizeValue(context, { state, depth: 0, seen: new WeakSet() });
};
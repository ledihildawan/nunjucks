import { isKeyedObject } from '@nunjucks/lib';
import { getBlockedKeyCategory, isDangerousGlobal, isDangerousReference } from '@nunjucks/security';
import { isFunction, keys } from 'remeda';
import { JS_BUILTIN_CONSTRUCTORS } from '../js-builtins.ts';

const isBlockedNestedContextKey = (key: string): boolean =>
  getBlockedKeyCategory(key, 'auto') === 'object_intrinsic';

const BUILTIN_GLOBALS = new Set(JS_BUILTIN_CONSTRUCTORS);

const isBuiltIn = (name: string): boolean => BUILTIN_GLOBALS.has(name);

interface ScanContext {
  allowedGlobals: ReadonlySet<string> | null;
  seen: WeakSet<object>;
}

interface ScanState {
  scan: ScanContext;
  isTopLevel: boolean;
  currentPath: string;
}

// WHY: recursion bound — the scanner is the pre-render security defense; a hostile
// deeply-nested context must not turn it into a stack overflow that escapes the
// render Result contract. Past the cap, scanning stops (pathological nesting is not
// by itself a dangerous reference — the runtime guards still apply at render time).
const MAX_SCAN_DEPTH = 128;

const checkKeyDangerous = (key: string, { isTopLevel, currentPath }: ScanState): string[] => {
  if (isBlockedNestedContextKey(key)) {
    return [currentPath];
  }
  if (isTopLevel && isDangerousGlobal(key)) {
    return [currentPath];
  }
  return [];
};

interface CheckValueDangerousInput extends ScanState {
  value: unknown;
  key: string;
}

const checkValueDangerous = ({
  value,
  key,
  scan,
  isTopLevel,
  currentPath,
}: CheckValueDangerousInput): string[] => {
  if (!isFunction(value) || !isTopLevel) {
    return [];
  }
  const fnName = value.name || key;
  // WHY: eval/Function are members of shared's UNIVERSAL_GLOBALS, so isDangerousGlobal
  // already covers them — no special-cased literals here.
  // WHY: the allowlist matches BOTH the registration key and the function's own name —
  // hosts allowlist by the context key they registered (`{ greet: function greet() {} }`
  // with allowedGlobals ['greet']), while named anonymous-fallback scanning keeps
  // working. Anonymous arrows fall through to the key via `fnName = value.name || key`.
  const dangerous =
    isDangerousGlobal(fnName) ||
    (!!scan.allowedGlobals &&
      !scan.allowedGlobals.has(fnName) &&
      !scan.allowedGlobals.has(key) &&
      !isBuiltIn(fnName));
  return dangerous ? [currentPath] : [];
};

interface RecursiveScanInput extends ScanState {
  value: unknown;
  depth: number;
}

const scanForDangerousValues = ({
  value: context,
  depth,
  ...state
}: RecursiveScanInput): string[] => {
  const { scan, currentPath: path, isTopLevel } = state;
  if (!isKeyedObject(context) || scan.seen.has(context) || depth >= MAX_SCAN_DEPTH) {
    return [];
  }
  // WHY: security scanners inherently require mutable cycle-tracking — WeakSet mutation
  // is confined to the scan call-stack and enables O(1) cycle detection without
  // polluting the returned array. This is an intentional exemption from the no-mutation rule.
  scan.seen.add(context);

  const record = context as Record<string, unknown>;
  return keys(record).flatMap((key) => {
    const childPath = path ? `${path}.${key}` : key;
    const value = record[key];
    const entryState: ScanState = { scan, isTopLevel, currentPath: childPath };
    const nested =
      value && typeof value === 'object' && !isDangerousReference(value)
        ? scanForDangerousValues({
            scan,
            isTopLevel: false,
            currentPath: childPath,
            value,
            depth: depth + 1,
          })
        : [];

    return [
      ...checkKeyDangerous(key, entryState),
      ...checkValueDangerous({ ...entryState, value, key }),
      ...(isDangerousReference(value) ? [childPath] : []),
      ...nested,
    ];
  });
};

/**
 * Scans a render context for dangerous values — blocked keys, dangerous
 * globals, top-level functions outside `allowedGlobals`, and dangerous
 * references — returning deduped dotted paths. Cycles are tracked via
 * `WeakSet` and nesting is depth-capped; an empty array means safe.
 */
export const findDangerousValues = (
  context: unknown,
  allowedGlobals?: readonly string[] | null
): string[] => {
  // WHY: Set built once per scan — the per-key checks below run for every context
  // entry, so O(1) has() replaces O(n) includes() scans on this security path.
  const paths = scanForDangerousValues({
    scan: { allowedGlobals: allowedGlobals ? new Set(allowedGlobals) : null, seen: new WeakSet() },
    isTopLevel: true,
    currentPath: '',
    value: context,
    depth: 0,
  });
  return [...new Set(paths)];
};

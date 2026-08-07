import type { UndefinedMode } from '@nunjucks/runtime';
import type { DomPurifyConfig } from '@nunjucks/shared';

type FilterObject = Readonly<Record<string, unknown>>;

const SAFE_BUILTINS: Readonly<Record<string, unknown>> = Object.freeze({
  JSON: Object.freeze({
    stringify: JSON.stringify,
    parse: JSON.parse,
  }),
  Math: Object.freeze({
    PI: Math.PI,
    E: Math.E,
    LN2: Math.LN2,
    LN10: Math.LN10,
    LOG2E: Math.LOG2E,
    LOG10E: Math.LOG10E,
    SQRT1_2: Math.SQRT1_2,
    SQRT2: Math.SQRT2,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    pow: Math.pow,
    sqrt: Math.sqrt,
    min: Math.min,
    max: Math.max,
    random: Math.random,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    log: Math.log,
    exp: Math.exp,
  }),
  Object: Object.freeze({
    keys: Object.keys,
    values: Object.values,
    entries: Object.entries,
    assign: Object.assign,
    create: Object.create,
    freeze: Object.freeze,
    seal: Object.seal,
    isFrozen: Object.isFrozen,
    isSealed: Object.isSealed,
    isExtensible: Object.isExtensible,
    hasOwn: Object.hasOwn,
    fromEntries: Object.fromEntries,
  }),
  Array: Object.freeze({
    isArray: Array.isArray,
    from: Array.from,
    of: Array.of,
  }),
  Number: Object.freeze({
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    isInteger: Number.isInteger,
    isSafeInteger: Number.isSafeInteger,
    parseInt: Number.parseInt,
    parseFloat: Number.parseFloat,
    MAX_VALUE: Number.MAX_VALUE,
    MIN_VALUE: Number.MIN_VALUE,
    POSITIVE_INFINITY: Number.POSITIVE_INFINITY,
    NEGATIVE_INFINITY: Number.NEGATIVE_INFINITY,
  }),
  String: Object.freeze({
    fromCharCode: String.fromCharCode,
    fromCodePoint: String.fromCodePoint,
    raw: String.raw,
  }),
  Date: Object.freeze({
    now: Date.now,
  }),
  Promise: Object.freeze({
    resolve: Promise.resolve,
    reject: Promise.reject,
    all: Promise.all,
    race: Promise.race,
    allSettled: Promise.allSettled,
    any: Promise.any,
  }),
  ArrayBuffer: Object.freeze({
    isView: ArrayBuffer.isView,
  }),
});

type SandboxEnvironment = 'auto' | 'node' | 'browser' | 'deno';
type SandboxMode = 'blocklist' | 'allowlist';

interface GlobalConfigBase {
  readonly sandbox: boolean;
  readonly sandboxAllowlist: readonly string[];
  readonly sandboxEnvironment: SandboxEnvironment;
  readonly sandboxMode: SandboxMode;
  readonly strictMode: boolean;
  readonly executionTimeout: number;
  readonly maxTemplateSize: number;
  readonly blockedContextKeys: readonly string[] | null;
  readonly scanContextValues: boolean;
  readonly autoescape: boolean;
  readonly trimBlocks: boolean;
  readonly lstripBlocks: boolean;
  readonly undefined: UndefinedMode;
  readonly filters: FilterObject;
  readonly globals: Readonly<Record<string, unknown>>;
  readonly extensions: Readonly<Record<string, unknown>>;
  readonly views: string | null;
  readonly dompurify: DomPurifyConfig;
}

interface GlobalConfig extends GlobalConfigBase {
  readonly [key: string]: unknown;
}

interface FilterBundle {
  readonly filters: FilterObject;
  readonly dompurify: DomPurifyConfig;
}

const DEFAULT_CONFIG: Omit<GlobalConfig, 'filters' | 'dompurify'> = Object.freeze({
  sandbox: false,
  sandboxAllowlist: Object.freeze([]),
  sandboxEnvironment: 'auto',
  sandboxMode: 'blocklist',
  strictMode: false,
  executionTimeout: 0,
  maxTemplateSize: 0,
  blockedContextKeys: null,
  scanContextValues: false,
  autoescape: true,
  trimBlocks: false,
  lstripBlocks: false,
  undefined: 'default',
  globals: SAFE_BUILTINS,
  extensions: Object.freeze({}),
  views: null,
});

const getDefaultConfig = (bundle?: FilterBundle): GlobalConfig => ({
  ...DEFAULT_CONFIG,
  filters: bundle?.filters ?? Object.freeze({}),
  dompurify: bundle?.dompurify ?? Object.freeze({}),
} as GlobalConfig);

export { getDefaultConfig };
export type { SandboxEnvironment, SandboxMode, UndefinedMode, GlobalConfig, FilterBundle, DomPurifyConfig };

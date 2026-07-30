import * as stringFilters from '@nunjucks/filters/string';
import * as arrayFilters from '@nunjucks/filters/array';
import * as objectFilters from '@nunjucks/filters/object';
import * as mathFilters from '@nunjucks/filters/math';
import { sanitize, type DomPurifyConfig } from '@nunjucks/filters';
import type { UndefinedMode } from '@nunjucks/runtime';

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
  Boolean: Object.freeze({
    // No static methods besides the constructor
  }),
  Date: Object.freeze({
    now: Date.now,
  }),
  Map: Object.freeze({
    // Safe Map constructor not exposed to prevent arbitrary map creation
  }),
  Set: Object.freeze({
    // Safe Set constructor not exposed to prevent arbitrary set creation
  }),
  RegExp: Object.freeze({
    // RegExp constructor not exposed for security
  }),
  Error: Object.freeze({
    // Error constructor not exposed
  }),
  TypeError: Object.freeze({
    // TypeError constructor not exposed
  }),
  RangeError: Object.freeze({
    // RangeError constructor not exposed
  }),
  SyntaxError: Object.freeze({
    // SyntaxError constructor not exposed
  }),
  Symbol: Object.freeze({
    // Symbol not exposed as it could be used dangerously
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
  DataView: Object.freeze({
    // DataView constructor not exposed
  }),
});

const builtInFilters: FilterObject = Object.freeze({
  ...stringFilters,
  ...arrayFilters,
  ...objectFilters,
  ...mathFilters,
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
  length: arrayFilters.lengthFilter,
  tojson: stringFilters.tojson,
  sanitize: sanitize as unknown as (...args: unknown[]) => unknown,
});

type SandboxEnvironment = 'auto' | 'node' | 'browser' | 'deno';
type SandboxMode = 'blocklist' | 'allowlist';

interface GlobalConfigBase {
  readonly sandbox: boolean;
  readonly sandboxAllowlist: readonly string[];
  readonly sandboxEnvironment: SandboxEnvironment;
  readonly sandboxMode: SandboxMode;
  readonly devWarningSandbox: boolean;
  readonly strictMode: boolean;
  readonly executionTimeout: number;
  readonly maxTemplateSize: number;
  readonly allowedContextKeys: readonly string[] | null;
  readonly blockedContextKeys: readonly string[] | null;
  readonly scanContextValues: boolean;
  readonly allowedTags: readonly string[] | null;
  readonly allowedFilters: readonly string[] | null;
  readonly blockedTags: readonly string[] | null;
  readonly blockedFilters: readonly string[] | null;
  readonly whitelistStrict: boolean;
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

const DEFAULT_CONFIG: GlobalConfig = Object.freeze({
  sandbox: false,
  sandboxAllowlist: Object.freeze([]),
  sandboxEnvironment: 'auto',
  sandboxMode: 'blocklist',
  devWarningSandbox: true,
  strictMode: false,
  executionTimeout: 0,
  maxTemplateSize: 0,
  allowedContextKeys: null,
  blockedContextKeys: null,
  scanContextValues: false,
  allowedTags: null,
  allowedFilters: null,
  blockedTags: null,
  blockedFilters: null,
  whitelistStrict: false,
  autoescape: true,
  trimBlocks: false,
  lstripBlocks: false,
  undefined: 'default',
  filters: builtInFilters,
  globals: SAFE_BUILTINS,
  extensions: Object.freeze({}),
  views: null,
  dompurify: Object.freeze({})
});

const getDefaultConfig = (): GlobalConfig => ({ ...DEFAULT_CONFIG });
interface ConfigValidationError {
  readonly field: string;
  readonly message: string;
}

export { getDefaultConfig };
export type { SandboxEnvironment, SandboxMode, UndefinedMode, GlobalConfig };

export type { DomPurifyConfig } from '@nunjucks/filters';
export { setDefaultDomPurifyConfig } from '@nunjucks/filters';
export type { ConfigValidationError };

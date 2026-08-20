import type { DomPurifyConfig, Environment, SandboxMode, UndefinedMode } from '@nunjucks/shared';
import packageJson from '../../package.json';

/** Engine version sourced from `package.json`; stamped into error markers and stream output. */
const PACKAGE_VERSION = packageJson.version as string;

export { PACKAGE_VERSION };

const SAFE_JSON = Object.freeze({
  stringify: JSON.stringify,
  parse: JSON.parse,
});

const SAFE_MATH = Object.freeze({
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
});

// WHY: no Object.assign/Object.create in the default template globals — assign is a
// [[Set]]-based mutation gadget (a prototype-pollution vector when a template passes an
// untrusted source object) and neither has a legitimate template-side use; values that
// need them must be prepared in the imperative shell before render.
const SAFE_OBJECT = Object.freeze({
  keys: Object.keys,
  values: Object.values,
  entries: Object.entries,
  freeze: Object.freeze,
  seal: Object.seal,
  isFrozen: Object.isFrozen,
  isSealed: Object.isSealed,
  isExtensible: Object.isExtensible,
  hasOwn: Object.hasOwn,
  fromEntries: Object.fromEntries,
});

const SAFE_ARRAY = Object.freeze({
  isArray: Array.isArray,
  from: Array.from,
  of: Array.of,
});

const SAFE_NUMBER = Object.freeze({
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
});

const SAFE_STRING = Object.freeze({
  fromCharCode: String.fromCharCode,
  fromCodePoint: String.fromCodePoint,
  raw: String.raw,
});

const SAFE_DATE = Object.freeze({
  now: Date.now,
});

const SAFE_PROMISE = Object.freeze({
  resolve: Promise.resolve,
  reject: Promise.reject,
  all: Promise.all,
  race: Promise.race,
  allSettled: Promise.allSettled,
  any: Promise.any,
});

const SAFE_ARRAYBUFFER = Object.freeze({
  isView: ArrayBuffer.isView,
});

const SAFE_BUILTINS: Readonly<Record<string, unknown>> = Object.freeze({
  JSON: SAFE_JSON,
  Math: SAFE_MATH,
  Object: SAFE_OBJECT,
  Array: SAFE_ARRAY,
  Number: SAFE_NUMBER,
  String: SAFE_STRING,
  Date: SAFE_DATE,
  Promise: SAFE_PROMISE,
  ArrayBuffer: SAFE_ARRAYBUFFER,
  version: PACKAGE_VERSION,
});

interface GlobalConfigBase {
  readonly sandbox: boolean;
  readonly sandboxAllowlist: readonly string[];
  readonly sandboxEnvironment: Environment;
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
  readonly filters: Readonly<Record<string, unknown>>;
  readonly globals: Readonly<Record<string, unknown>>;
  readonly extensions: Readonly<Record<string, unknown>>;
  readonly views: string | string[] | null;
  readonly dompurify: DomPurifyConfig;
}

/**
 * The engine's fully-resolved defaults — `GlobalConfigBase` plus an index
 * signature so the loose `RenderOptions` input bag can spread it unchecked.
 */
interface GlobalConfig extends GlobalConfigBase {
  readonly [key: string]: unknown;
}

/** A frozen pair of built-in filters and their `dompurify` sanitizer config. */
interface FilterBundle {
  readonly filters: Readonly<Record<string, unknown>>;
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
  scanContextValues: true,
  autoescape: true,
  trimBlocks: false,
  lstripBlocks: false,
  undefined: 'default',
  globals: SAFE_BUILTINS,
  extensions: Object.freeze({}),
  views: null,
});

/**
 * Builds the frozen default `GlobalConfig` — sandbox and autoescape defaults,
 * safe built-in globals, plus the supplied (or empty) filter bundle.
 */
const getDefaultConfig = (bundle?: FilterBundle): GlobalConfig =>
  ({
    ...DEFAULT_CONFIG,
    filters: bundle?.filters ?? Object.freeze({}),
    dompurify: bundle?.dompurify ?? Object.freeze({}),
  }) as GlobalConfig;

export type {
  DomPurifyConfig,
  Environment as SandboxEnvironment,
  FilterBundle,
  GlobalConfig,
  SandboxMode,
  UndefinedMode,
};
export { getDefaultConfig };

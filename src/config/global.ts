import * as stringFilters from '@nunjucks/filters/string';
import * as arrayFilters from '@nunjucks/filters/array';
import * as objectFilters from '@nunjucks/filters/object';
import * as mathFilters from '@nunjucks/filters/math';
import type { Result } from './result.js';

type FilterObject = Readonly<Record<string, unknown>>;

const builtInFilters: FilterObject = Object.freeze({
  ...stringFilters,
  ...arrayFilters,
  ...objectFilters,
  ...mathFilters,
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
  length: arrayFilters.lengthFilter,
  int: mathFilters.intFilter,
});

export type SandboxEnvironment = 'auto' | 'node' | 'browser' | 'deno';
export type SandboxMode = 'blocklist' | 'allowlist';
export type UndefinedMode = 'default' | 'chainable' | 'strict' | 'debug';

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
}

export interface GlobalConfig extends GlobalConfigBase {
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
  globals: Object.freeze({}),
  extensions: Object.freeze({}),
  views: null
});

let _globalConfig: GlobalConfig = { ...DEFAULT_CONFIG };

export const getGlobalConfig = (): GlobalConfig => ({ ..._globalConfig });

export const setGlobalConfig = (config: Partial<GlobalConfig>): GlobalConfig => {
  _globalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    filters: { ...builtInFilters, ...(config.filters || {}) },
    globals: { ...(config.globals || {}) },
    extensions: { ...(config.extensions || {}) }
  };
  return _globalConfig;
};

export const mergeConfig = (localConfig: Partial<GlobalConfig> = {}): GlobalConfig => ({
  ..._globalConfig,
  ...localConfig,
  filters: { ..._globalConfig.filters as FilterObject, ...(localConfig.filters || {}) as FilterObject },
  globals: { ..._globalConfig.globals as Readonly<Record<string, unknown>>, ...(localConfig.globals || {}) as Record<string, unknown> },
  extensions: { ..._globalConfig.extensions as Readonly<Record<string, unknown>>, ...(localConfig.extensions || {}) as Record<string, unknown> }
});

export const getDefaultConfig = (): GlobalConfig => ({ ...DEFAULT_CONFIG });

export const resetConfig = (): GlobalConfig => {
  _globalConfig = { ...DEFAULT_CONFIG };
  return _globalConfig;
};

export const isConfigured = (): boolean =>
  (Object.keys(_globalConfig) as Array<keyof GlobalConfig>).some(key =>
    key !== 'filters' && key !== 'globals' && key !== 'extensions'
      ? _globalConfig[key] !== DEFAULT_CONFIG[key]
      : Object.keys(_globalConfig[key] as Record<string, unknown>).length > 0
  );

type ConfigValidationError = {
  readonly field: string;
  readonly message: string;
};

export type { ConfigValidationError };
export type { Result };

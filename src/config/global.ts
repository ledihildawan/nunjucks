import * as stringFilters from '@nunjucks/filters/string';
import * as arrayFilters from '@nunjucks/filters/array';
import * as objectFilters from '@nunjucks/filters/object';
import * as mathFilters from '@nunjucks/filters/math';

type FilterObject = Record<string, unknown>;

const builtInFilters: Record<string, unknown> = {
  ...stringFilters,
  ...arrayFilters,
  ...objectFilters,
  ...mathFilters,
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
  length: arrayFilters.lengthFilter,
  int: mathFilters.intFilter,
};

interface GlobalConfig {
  sandbox: boolean;
  sandboxAllowlist: string[];
  sandboxEnvironment: string;
  sandboxMode: string;
  devWarningSandbox: boolean;
  strictMode: boolean;
  executionTimeout: number;
  maxTemplateSize: number;
  allowedContextKeys: string[] | null;
  blockedContextKeys: string[] | null;
  scanContextValues: boolean;
  allowedTags: string[] | null;
  allowedFilters: string[] | null;
  blockedTags: string[] | null;
  blockedFilters: string[] | null;
  whitelistStrict: boolean;
  autoescape: boolean;
  trimBlocks: boolean;
  lstripBlocks: boolean;
  undefined: string;
  filters: FilterObject;
  globals: Record<string, unknown>;
  extensions: Record<string, unknown>;
  views: string | null;
  [key: string]: unknown;
}

const DEFAULT_CONFIG: GlobalConfig = Object.freeze({
  sandbox: false,
  sandboxAllowlist: [],
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
  globals: {},
  extensions: {},
  views: null
}) as GlobalConfig;

let _globalConfig: GlobalConfig = { ...DEFAULT_CONFIG };

export const getGlobalConfig = (): GlobalConfig => ({ ..._globalConfig });

export const setGlobalConfig = (config: Partial<GlobalConfig>): GlobalConfig => {
  _globalConfig = { ...DEFAULT_CONFIG, ...config };
  return _globalConfig;
};

export const mergeConfig = (localConfig: Partial<GlobalConfig>): GlobalConfig => {
  return {
    ..._globalConfig,
    ...localConfig,
    filters: { ..._globalConfig.filters, ...(localConfig.filters || {}) },
    globals: { ..._globalConfig.globals, ...(localConfig.globals || {}) },
    extensions: { ..._globalConfig.extensions, ...(localConfig.extensions || {}) }
  };
};

export const getDefaultConfig = (): GlobalConfig => ({ ...DEFAULT_CONFIG });

export const resetConfig = (): GlobalConfig => {
  _globalConfig = { ...DEFAULT_CONFIG };
  return _globalConfig;
};

export const isConfigured = (): boolean => {
  return Object.keys(_globalConfig).some(key =>
    key !== 'filters' && key !== 'globals' && key !== 'extensions'
      ? _globalConfig[key as keyof GlobalConfig] !== DEFAULT_CONFIG[key as keyof GlobalConfig]
      : Object.keys(_globalConfig[key as keyof GlobalConfig] as Record<string, unknown>).length > 0
  );
};

import * as stringFilters from '@nunjucks/filters/string';
import * as arrayFilters from '@nunjucks/filters/array';
import * as objectFilters from '@nunjucks/filters/object';
import * as mathFilters from '@nunjucks/filters/math';

const builtInFilters = {
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

const DEFAULT_CONFIG = Object.freeze({
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
});

let _globalConfig = { ...DEFAULT_CONFIG };

export const getGlobalConfig = () => ({ ..._globalConfig });

export const setGlobalConfig = (config) => {
  _globalConfig = { ...DEFAULT_CONFIG, ...config };
  return _globalConfig;
};

export const mergeConfig = (localConfig) => {
  return {
    ..._globalConfig,
    ...localConfig,
    filters: { ..._globalConfig.filters, ...(localConfig.filters || {}) },
    globals: { ..._globalConfig.globals, ...(localConfig.globals || {}) },
    extensions: { ..._globalConfig.extensions, ...(localConfig.extensions || {}) }
  };
};

export const getDefaultConfig = () => ({ ...DEFAULT_CONFIG });

export const resetConfig = () => {
  _globalConfig = { ...DEFAULT_CONFIG };
  return _globalConfig;
};

export const isConfigured = () => {
  return Object.keys(_globalConfig).some(key => 
    key !== 'filters' && key !== 'globals' && key !== 'extensions'
      ? _globalConfig[key] !== DEFAULT_CONFIG[key]
      : Object.keys(_globalConfig[key]).length > 0
  );
};

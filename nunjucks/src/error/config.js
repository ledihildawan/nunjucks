import { isDevelopment } from '../lib/environment-check.js';

const DEFAULT_CONFIG = {
  ide: 'vscode',
  version: '3.2.4',
  csp: {
    enabled: false,
    nonceHeader: null,
    nonceGenerator: null
  }
};

export const createConfigStore = (initial = {}) => {
  let state = { ...DEFAULT_CONFIG, ...initial };
  return {
    get: () => ({
      dev: isDevelopment(),
      ...state
    }),
    set: (options = {}) => {
      if (options.ide !== undefined) state.ide = options.ide;
      if (options.version !== undefined) state.version = options.version;
      if (options.csp) {
        state.csp = { ...state.csp, ...options.csp };
      }
    },
    getIde: () => state.ide,
    getVersion: () => state.version,
    getCsp: () => ({ ...state.csp })
  };
};

export const errorConfig = createConfigStore();

export const getErrorConfig = () => errorConfig.get();

export const setErrorConfig = (options = {}) => errorConfig.set(options);

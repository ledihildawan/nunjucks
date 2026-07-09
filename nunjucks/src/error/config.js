import { isDevelopment } from '../lib/environment-check.js';

let _config = {
  ide: 'vscode',
  version: '3.2.4',
  csp: {
    enabled: false,
    nonceHeader: null,
    nonceGenerator: null
  }
};

export const getErrorConfig = () => ({
  dev: isDevelopment(),
  ..._config
});

export const setErrorConfig = (options = {}) => {
  if (options.ide !== undefined) _config.ide = options.ide;
  if (options.version !== undefined) _config.version = options.version;
  if (options.csp) {
    _config.csp = { ..._config.csp, ...options.csp };
  }
};

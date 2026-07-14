const BLOCKED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'global',
  'globalThis',
  'window',
  'process',
  'eval',
  'Function',
]);

const NODE_BLOCKED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'process',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'eval',
  'Function',
]);

const BROWSER_BLOCKED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
]);

const DENO_BLOCKED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'Deno',
  'process',
  'eval',
  'Function',
]);

const DANGEROUS_GLOBALS = new Set([
  'global',
  'globalThis',
  'window',
  'process',
  'eval',
  'Function',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
]);

const CODE_EXECUTION_PATTERNS = new Set([
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'exec',
  'execSync',
  'spawn',
  'spawnSync',
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
]);

export const isCodeExecutionPattern = (key) => CODE_EXECUTION_PATTERNS.has(key);

export const ENVIRONMENTS = {
  NODE: 'node',
  BROWSER: 'browser',
  DENO: 'deno',
};

export const isBlockedKey = (key, env = 'auto') => {
  if (BLOCKED_KEYS.has(key)) return true;
  
  if (env === 'auto' || env === 'node') {
    return NODE_BLOCKED_KEYS.has(key);
  }
  if (env === 'browser') {
    return BROWSER_BLOCKED_KEYS.has(key);
  }
  if (env === 'deno') {
    return DENO_BLOCKED_KEYS.has(key);
  }
  
  return false;
};

export const isDangerousGlobal = (key) => DANGEROUS_GLOBALS.has(key);

export const BLOCKED_KEYS_LIST = [...BLOCKED_KEYS];
export const DANGEROUS_GLOBALS_LIST = [...DANGEROUS_GLOBALS];

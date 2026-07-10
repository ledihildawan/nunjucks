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

export const isBlockedKey = (key) => BLOCKED_KEYS.has(key);

export const isDangerousGlobal = (key) => DANGEROUS_GLOBALS.has(key);

export const BLOCKED_KEYS_LIST = [...BLOCKED_KEYS];
export const DANGEROUS_GLOBALS_LIST = [...DANGEROUS_GLOBALS];

import { Template } from '../template/index.js';

export const isRelativePath = (loader, filename) =>
  (loader.isRelative && filename) ? loader.isRelative(filename) : false;

export const resolveTemplatePath = (loader, parentName, filename) =>
  isRelativePath(loader, filename) && loader.resolve
    ? loader.resolve(parentName, filename)
    : filename;

export const findCachedTemplate = (loaders, resolveFn, name, parentName) => {
  for (const loader of loaders) {
    const resolved = resolveFn(loader, parentName, name);
    const cached = loader.cache[resolved];
    if (cached) return { tmpl: cached, loader };
  }
  return null;
};

export const normalizeIncludeChain = (includeChain) => {
  if (!includeChain) return { parentName: null, chain: null };
  if (typeof includeChain === 'string') return { parentName: includeChain, chain: null };
  if (typeof includeChain === 'object') return { parentName: includeChain.parentTmpl, chain: includeChain };
  return { parentName: null, chain: null };
};

export const resolveTemplateName = (name) => name?.raw || name;

export const validateTemplateName = (name) => {
  if (name instanceof Template) return null;
  if (typeof name === 'string') return null;
  const err = new Error('template names must be a string: ' + name);
  err.code = 'INVALID_INCLUDE';
  throw err;
};

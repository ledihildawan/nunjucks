import { pipe, filter, map } from 'remeda';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createLoader } from './base.js';

const _require = createRequire(import.meta.url);

const isRelativePath = pipe(
  (name) => (/^\.?\.?(\/|\\)/).test(name)
);

const isWindowsAbsolutePath = pipe(
  (name) => (/^[A-Z]:/).test(name)
);

const isExternalModule = (name) => !isRelativePath(name) && !isWindowsAbsolutePath(name);

const tryRequireResolve = (name) => {
  try { return _require.resolve(name); }
  catch { return null; }
};

const findInSearchPaths = (searchPaths, name) => {
  for (const basePath of searchPaths) {
    const fullPath = resolve(basePath, name);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
};

const readSource = (fullpath, noCache) => ({
  src: readFileSync(fullpath, 'utf-8'),
  path: fullpath,
  noCache
});

export function createNodeResolveLoader(opts = {}) {
  const loader = createLoader();
  loader.typename = 'NodeResolveLoader';
  loader.pathsToNames = {};
  loader.noCache = !!opts.noCache;
  loader.paths = opts.paths || [];
  loader.async = true;

  loader.getSource = async (name) => {
    if (!isExternalModule(name)) return null;

    let fullpath = tryRequireResolve(name);
    if (!fullpath) {
      fullpath = findInSearchPaths(loader.paths, name);
      if (!fullpath) return null;
    }

    loader.pathsToNames[fullpath] = name;
    const source = readSource(fullpath, loader.noCache);
    loader.emit('load', name, source);
    return source;
  };

  return loader;
}

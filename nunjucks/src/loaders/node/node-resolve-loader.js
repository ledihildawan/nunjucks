import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import Loader from '../base-loader.js';

const _require = createRequire(import.meta.url);

const isRelativePath = (name) => (/^\.?\.?(\/|\\)/).test(name);
const isWindowsAbsolutePath = (name) => (/^[A-Z]:/).test(name);
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

export class NodeResolveLoader extends Loader {
  constructor(opts = {}) {
    super();
    this.pathsToNames = {};
    this.noCache = !!opts.noCache;
    this.paths = opts.paths || [];
    this.async = true;
  }

  async getSource(name) {
    if (!isExternalModule(name)) return null;

    let fullpath = tryRequireResolve(name);
    if (!fullpath) {
      fullpath = findInSearchPaths(this.paths, name);
      if (!fullpath) return null;
    }

    this.pathsToNames[fullpath] = name;
    const source = readSource(fullpath, this.noCache);
    this.emit('load', name, source);
    return source;
  }
}

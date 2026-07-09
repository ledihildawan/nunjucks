import { pipe } from 'remeda';
import { existsSync, readFileSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { watch } from 'fs';
import Loader from '../base-loader.js';

const normalizeSearchPaths = (searchPaths) =>
  !searchPaths ? ['.'] : (Array.isArray(searchPaths) ? searchPaths : [searchPaths]).map(normalize);

const isPathWithinBase = (basePath) => (filePath) => filePath.indexOf(basePath) === 0;

const resolveFromSearchPath = (name) => (searchPath) => {
  const basePath = resolve(searchPath);
  const fullPath = resolve(searchPath, name);
  return { basePath, fullPath };
};

const existsAndWithinBase = (basePath) => ({ fullPath }) =>
  isPathWithinBase(basePath)(fullPath) && existsSync(fullPath);

const findFileInSearchPaths = (searchPaths, name) => {
  for (const searchPath of searchPaths) {
    const { basePath, fullPath } = resolveFromSearchPath(name)(searchPath);
    if (existsAndWithinBase(basePath)({ fullPath })) {
      return fullPath;
    }
  }
  return null;
};

const readFileSource = (fullpath) => ({
  src: readFileSync(fullpath, 'utf-8'),
  path: fullpath
});

const normalizeFilePath = (path) => resolve(normalize(path));

const isFileChangeEvent = (eventType) => eventType === 'change' || eventType === 'rename';

const createFileCacheInvalidator = (cache) => (normalizedPath) => {
  for (const [key, tmpl] of Object.entries(cache)) {
    if (tmpl?.path && normalizeFilePath(tmpl.path) === normalizedPath) {
      cache[key] = null;
    }
  }
};

const createWatchHandler = (loader, filePath) => (eventType, filename) => {
  if (!isFileChangeEvent(eventType)) return;

  const name = filename || filePath;
  loader.cache = loader.cache || {};
  createFileCacheInvalidator(loader.cache)(normalizeFilePath(filePath));
  loader.emit('update', name, filePath);

  if (eventType === 'rename') loader.unwatchFile(filePath);
};

export class FileSystemLoader extends Loader {
  constructor(searchPaths, opts = {}) {
    super();
    if (typeof opts === 'boolean') {
      console.warn(
        '[nunjucks] Warning: boolean options are deprecated. ' +
        'Use an options object. ' +
        'See http://mozilla.github.io/nunjucks/api.html#filesystemloader'
      );
    }

    this.pathsToNames = {};
    this.noCache = !!opts.noCache;
    this.watchEnabled = !!opts.watch;
    this.async = true;
    this.watchedFiles = new Map();
    this.searchPaths = normalizeSearchPaths(searchPaths);
  }

  async getSource(name) {
    const fullpath = findFileInSearchPaths(this.searchPaths, name);
    if (!fullpath) return null;

    this.pathsToNames[fullpath] = name;
    if (this.watchEnabled) this.watchFile(fullpath);

    const source = readFileSource(fullpath);
    this.emit('load', name, source);
    return source;
  }

  watchFile(filePath) {
    if (this.watchedFiles.has(filePath)) return;

    const watcher = watch(filePath, createWatchHandler(this, filePath));
    this.watchedFiles.set(filePath, watcher);
  }

  unwatchFile(filePath) {
    const watcher = this.watchedFiles.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchedFiles.delete(filePath);
    }
  }

  unwatchAll() {
    for (const [, watcher] of this.watchedFiles) watcher.close();
    this.watchedFiles.clear();
  }
}

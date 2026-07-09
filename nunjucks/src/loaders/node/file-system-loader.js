import { existsSync, readFileSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { watch } from 'fs';
import Loader from '../base-loader.js';

const normalizeSearchPaths = (searchPaths) => {
  if (!searchPaths) return ['.'];
  return (Array.isArray(searchPaths) ? searchPaths : [searchPaths]).map(normalize);
};

const isPathWithinBase = (filePath, basePath) => filePath.indexOf(basePath) === 0;

const findFileInSearchPaths = (searchPaths, name) => {
  for (const searchPath of searchPaths) {
    const basePath = resolve(searchPath);
    const fullPath = resolve(searchPath, name);
    if (isPathWithinBase(fullPath, basePath) && existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
};

const readFileSource = (fullpath) => ({
  src: readFileSync(fullpath, 'utf-8'),
  path: fullpath
});

const normalizeFilePath = (filePath) => normalize(resolve(filePath));

const isFileChangeEvent = (eventType) => eventType === 'change' || eventType === 'rename';

export class FileSystemLoader extends Loader {
  constructor(searchPaths, opts = {}) {
    super();
    if (typeof opts === 'boolean') {
      console.warn(
        '[nunjucks] Warning: you passed a boolean as the second ' +
        'argument to FileSystemLoader, which is deprecated. ' +
        'Use an options object instead. ' +
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

    const normalizedPath = normalizeFilePath(filePath);
    const watcher = watch(filePath, (eventType, filename) => {
      if (!isFileChangeEvent(eventType)) return;

      const name = filename || filePath;
      this.cache = this.cache || {};
      this.invalidateCacheForPath(normalizedPath);
      this.emit('update', name, filePath);

      if (eventType === 'rename') this.unwatchFile(filePath);
    });

    this.watchedFiles.set(filePath, watcher);
  }

  invalidateCacheForPath(normalizedPath) {
    for (const [key, tmpl] of Object.entries(this.cache)) {
      if (tmpl?.path && normalizeFilePath(tmpl.path) === normalizedPath) {
        this.cache[key] = null;
      }
    }
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

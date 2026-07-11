import { pipe, entries, isArray } from 'remeda';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { watch } from 'fs';
import { createLoader } from './base.js';

const normalizeSearchPaths = (searchPaths) =>
  !searchPaths ? ['.'] : (isArray(searchPaths) ? searchPaths : [searchPaths]).map(path.normalize);

const isPathWithinBase = (basePath) => (filePath) => filePath.indexOf(basePath) === 0;

const resolveFromSearchPath = (name) => (searchPath) => {
  const basePath = path.resolve(searchPath);
  const fullPath = path.resolve(searchPath, name);
  return { basePath, fullPath };
};

const existsAndWithinBase = (basePath) => ({ fullPath }) => {
  if (!isPathWithinBase(basePath)(fullPath)) return false;
  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const err = new Error(`EISDIR: illegal operation - path is a directory: ${fullPath}`);
      err.code = 'FILESYSTEM_ERROR';
      throw err;
    }
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Check if the base path (search path) exists
      try {
        statSync(basePath);
      } catch (baseErr) {
        if (baseErr.code === 'ENOENT') {
          const pathErr = new Error(`ENOENT: no such file or directory: ${basePath}`);
          pathErr.code = 'FILESYSTEM_ERROR';
          throw pathErr;
        }
        baseErr.code = 'FILESYSTEM_ERROR';
        throw baseErr;
      }
      return false;
    }
    if (err.code === 'EISDIR') {
      err.code = 'FILESYSTEM_ERROR';
      throw err;
    }
    err.code = 'FILESYSTEM_ERROR';
    throw err;
  }
};

const findFileInSearchPaths = (searchPaths, name) => {
  for (const searchPath of searchPaths) {
    try {
      const { basePath, fullPath } = resolveFromSearchPath(name)(searchPath);
      if (existsAndWithinBase(basePath)({ fullPath })) {
        return fullPath;
      }
    } catch (err) {
      throw err;
    }
  }
  return null;
};

const readFileSource = (fullpath) => {
  try {
    return {
      src: readFileSync(fullpath, 'utf-8'),
      path: fullpath
    };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    err.code = 'FILESYSTEM_ERROR';
    throw err;
  }
};

const normalizeFilePath = (p) => path.resolve(path.normalize(p));

const isFileChangeEvent = (eventType) => eventType === 'change' || eventType === 'rename';

const createFileCacheInvalidator = (cache) => (normalizedPath) => {
  for (const [key, tmpl] of entries(cache)) {
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

export function createFileSystemLoader(searchPaths, opts = {}) {
  if (typeof opts === 'boolean') {
    console.warn(
      '[nunjucks] Warning: boolean options are deprecated. ' +
      'Use an options object. ' +
      'See http://mozilla.github.io/nunjucks/api.html#filesystemloader'
    );
  }

  const loader = createLoader();
  loader.typename = 'FileSystemLoader';

  loader.pathsToNames = {};
  loader.noCache = !!opts.noCache;
  loader.watchEnabled = !!opts.watch;
  loader.async = true;
  loader.watchedFiles = new Map();
  loader.searchPaths = normalizeSearchPaths(searchPaths);

  loader.getSource = async function(name) {
    const fullpath = findFileInSearchPaths(loader.searchPaths, name);
    if (!fullpath) return null;

    loader.pathsToNames[fullpath] = name;
    if (loader.watchEnabled) loader.watchFile(fullpath);

    const source = readFileSource(fullpath);
    loader.emit('load', name, source);
    return source;
  };

  loader.watchFile = function(filePath) {
    if (loader.watchedFiles.has(filePath)) return;

    const watcher = watch(filePath, createWatchHandler(loader, filePath));
    loader.watchedFiles.set(filePath, watcher);
  };

  loader.unwatchFile = function(filePath) {
    const watcher = loader.watchedFiles.get(filePath);
    if (watcher) {
      watcher.close();
      loader.watchedFiles.delete(filePath);
    }
  };

  loader.unwatchAll = function() {
    for (const [, watcher] of loader.watchedFiles) watcher.close();
    loader.watchedFiles.clear();
  };

  return loader;
}

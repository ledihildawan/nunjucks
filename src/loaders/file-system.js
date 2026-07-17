import { entries, isArray } from 'remeda';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { watch } from 'fs';
import { createLoader } from './base.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import { createLog } from '@nunjucks/log';

const normalizeSearchPaths = (searchPaths) =>
  !searchPaths ? ['.'] : (isArray(searchPaths) ? searchPaths : [searchPaths]).map(path.normalize);

const isPathWithinBase = (basePath) => (filePath) => filePath.startsWith(basePath);

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
        throw createLog(
          'error',
          ERROR_DEFINITIONS.FILESYSTEM_ERROR,
          { msg: `EISDIR: illegal operation - path is a directory: ${fullPath}` },
          fullPath,
          { phase: 'load' }
        );
      }
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Check if the base path (search path) exists
        try {
          statSync(basePath);
        } catch (baseErr) {
          if (baseErr.code === 'ENOENT') {
            throw createLog(
              'error',
              ERROR_DEFINITIONS.FILESYSTEM_ERROR,
              { msg: `ENOENT: no such file or directory: ${basePath}` },
              basePath,
              { phase: 'load' }
            );
          }
          throw createLog(
            'error',
            ERROR_DEFINITIONS.FILESYSTEM_ERROR,
            { msg: String(baseErr) },
            basePath,
            { phase: 'load' }
          );
        }
        return false;
      }
      if (err.code === 'EISDIR') {
        throw createLog(
          'error',
          ERROR_DEFINITIONS.FILESYSTEM_ERROR,
          { msg: String(err) },
          fullPath,
          { phase: 'load' }
        );
      }
      throw createLog(
        'error',
        ERROR_DEFINITIONS.FILESYSTEM_ERROR,
        { msg: String(err) },
        fullPath,
        { phase: 'load' }
      );
    }
};

const findFileInSearchPaths = (searchPaths, name) => {
  for (const searchPath of searchPaths) {
    const { basePath, fullPath } = resolveFromSearchPath(name)(searchPath);
    if (existsAndWithinBase(basePath)({ fullPath })) {
      return fullPath;
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
    throw createLog(
      'error',
      ERROR_DEFINITIONS.FILESYSTEM_ERROR,
      { msg: String(err) },
      fullpath,
      { phase: 'load' }
    );
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
  loader.pathsToNames = {};
  loader.noCache = Boolean(opts.noCache);
  loader.watchEnabled = Boolean(opts.watch);
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

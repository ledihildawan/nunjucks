import { entries, isArray } from 'remeda';
import { readFile, stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { createLoader, type Loader } from './base.ts';
import { getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

const normalizeSearchPaths = (searchPaths: string | string[] | undefined): string[] => {
  if (!searchPaths) {
    return ['.'];
  }
  if (isArray(searchPaths)) {
    return searchPaths.map(path.normalize);
  }
  return [path.normalize(searchPaths)];
};

const isPathWithinBase = (basePath: string) => (filePath: string) => filePath.startsWith(basePath);

const resolveFromSearchPath = (name: string) => (searchPath: string) => {
  const basePath = path.resolve(searchPath);
  const fullPath = path.resolve(searchPath, name);
  return { basePath, fullPath };
};

const existsAndWithinBase = (basePath: string) => async ({ fullPath }: { fullPath: string }): Promise<boolean> => {
  if (!isPathWithinBase(basePath)(fullPath)) { return false; }
  try {
    const fileStat = await stat(fullPath);
    if (fileStat.isDirectory()) {
      throw createLog(
        'error',
        getError('FILESYSTEM_ERROR'),
        { msg: `EISDIR: illegal operation - path is a directory: ${fullPath}` },
        fullPath,
        { phase: 'load' }
      );
    }
    return true;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string };
      if (e.code === 'ENOENT') {
        try {
          await stat(basePath);
        } catch (baseErr: unknown) {
          if (baseErr && typeof baseErr === 'object' && 'code' in baseErr) {
            const be = baseErr as { code: string };
            if (be.code === 'ENOENT') {
              throw createLog(
                'error',
                getError('FILESYSTEM_ERROR'),
                { msg: `ENOENT: no such file or directory: ${basePath}` },
                basePath,
                { phase: 'load' }
              );
            }
          }
          throw createLog(
            'error',
            getError('FILESYSTEM_ERROR'),
            { msg: String(baseErr) },
            basePath,
            { phase: 'load' }
          );
        }
        return false;
      }
      if (e.code === 'EISDIR') {
        throw createLog(
          'error',
          getError('FILESYSTEM_ERROR'),
          { msg: String(err) },
          fullPath,
          { phase: 'load' }
        );
      }
    }
    throw createLog(
      'error',
      getError('FILESYSTEM_ERROR'),
      { msg: String(err) },
      fullPath,
      { phase: 'load' }
    );
  }
};

const findFileInSearchPaths = async (searchPaths: string[], name: string): Promise<string | null> => {
  for (const searchPath of searchPaths) {
    const { basePath, fullPath } = resolveFromSearchPath(name)(searchPath);
    // biome-ignore lint/performance/noAwaitInLoops: search paths are ordered and the first match wins, so these lookups cannot be run in parallel.
    if (await existsAndWithinBase(basePath)({ fullPath })) {
      return fullPath;
    }
  }
  return null;
};

const readFileSource = async (fullpath: string): Promise<FileSystemLoaderSource | null> => {
  try {
    return {
      src: await readFile(fullpath, 'utf-8'),
      path: fullpath
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') { return null; }
    throw createLog(
      'error',
      getError('FILESYSTEM_ERROR'),
      { msg: String(err) },
      fullpath,
      { phase: 'load' }
    );
  }
};

const normalizeFilePath = (p: string) => path.resolve(path.normalize(p));

const isFileChangeEvent = (eventType: string) => eventType === 'change' || eventType === 'rename';

const createFileCacheInvalidator = (cache: Record<string, unknown>) => (normalizedPath: string) => {
  for (const [key, tmpl] of entries(cache)) {
    if (tmpl && typeof tmpl === 'object' && 'path' in tmpl && normalizeFilePath((tmpl as { path: string }).path) === normalizedPath) {
      cache[key] = null;
    }
  }
};

interface FileSystemLoaderExtended {
  pathsToNames: Record<string, string>;
  noCache: boolean;
  watchEnabled: boolean;
  async: true;
  watchedFiles: Map<string, FSWatcher>;
  searchPaths: string[];
  cache: Record<string, unknown>;
  emit: (event: string, ...args: unknown[]) => void;
  unwatchFile: (filePath: string) => void;
}

const createWatchHandler = (loader: FileSystemLoaderExtended, filePath: string) => (eventType: string, filename: string | null) => {
  if (!isFileChangeEvent(eventType)) { return; }

  const name = filename || filePath;
  createFileCacheInvalidator(loader.cache)(normalizeFilePath(filePath));
  loader.emit('update', name, filePath);

  if (eventType === 'rename') { loader.unwatchFile(filePath); }
};

export interface FileSystemLoaderSource {
  src: string;
  path: string;
}

export interface FileSystemLoaderOptions {
  noCache?: boolean;
  watch?: boolean;
}

export interface FileSystemLoader extends Loader {
  pathsToNames: Record<string, string>;
  noCache: boolean;
  watchEnabled: boolean;
  async: true;
  watchedFiles: Map<string, FSWatcher>;
  searchPaths: string[];
  cache: Record<string, unknown>;
  getSource: (name: string) => Promise<FileSystemLoaderSource | null>;
  watchFile: (filePath: string) => void;
  unwatchFile: (filePath: string) => void;
  unwatchAll: () => void;
}

export function createFileSystemLoader(searchPaths: string | string[] | undefined, opts: FileSystemLoaderOptions = {}): FileSystemLoader {
  if (typeof opts === 'boolean') {
    // biome-ignore lint/suspicious/noConsole: deprecation notice for a legacy call shape; there is no logger at this layer.
    console.warn(
      '[nunjucks] Warning: boolean options are deprecated. ' +
      'Use an options object. ' +
      'See http://mozilla.github.io/nunjucks/api.html#filesystemloader'
    );
  }

  const loader = createLoader() as FileSystemLoader;
  loader.pathsToNames = {};
  loader.noCache = Boolean(opts.noCache);
  loader.watchEnabled = Boolean(opts.watch);
  loader.async = true;
  loader.watchedFiles = new Map();
  loader.searchPaths = normalizeSearchPaths(searchPaths);
  loader.cache = {};

  loader.getSource = async (name: string): Promise<FileSystemLoaderSource | null> => {
    const fullpath = await findFileInSearchPaths(loader.searchPaths, name);
    if (!fullpath) { return null; }

    loader.pathsToNames[fullpath] = name;
    if (loader.watchEnabled) { loader.watchFile(fullpath); }

    const source = await readFileSource(fullpath);
    loader.emit('load', name, source);
    return source;
  };

  loader.watchFile = (filePath: string): void => {
    if (loader.watchedFiles.has(filePath)) { return; }

    const watcher = watch(filePath, createWatchHandler(loader, filePath));
    loader.watchedFiles.set(filePath, watcher);
  };

  loader.unwatchFile = (filePath: string): void => {
    const watcher = loader.watchedFiles.get(filePath);
    if (watcher) {
      watcher.close();
      loader.watchedFiles.delete(filePath);
    }
  };

  loader.unwatchAll = (): void => {
    for (const [, watcher] of loader.watchedFiles) { watcher.close(); }
    loader.watchedFiles.clear();
  };

  return loader;
}

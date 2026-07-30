import { entries, filter, forEach, isArray } from 'remeda';
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

const makeFilesystemError = (targetPath: string, message: string) =>
  createLog('error', getError('FILESYSTEM_ERROR'), { msg: message }, targetPath, { phase: 'load' });

const throwDirectoryError = (fullPath: string): never => {
  throw makeFilesystemError(fullPath, `EISDIR: illegal operation - path is a directory: ${fullPath}`);
};

const hasErrorCode = (err: unknown): err is { code: string } =>
  err !== null && typeof err === 'object' && 'code' in err;

const isFileNotFoundError = (err: unknown): boolean =>
  hasErrorCode(err) && (err as { code: string }).code === 'ENOENT';

const throwBasePathNotFoundError = (basePath: string, baseErr: unknown): never => {
  const message = isFileNotFoundError(baseErr)
    ? `ENOENT: no such file or directory: ${basePath}`
    : String(baseErr);
  throw makeFilesystemError(basePath, message);
};

const checkFileExists = async (fullPath: string): Promise<void> => {
  const fileStat = await stat(fullPath);
  if (fileStat.isDirectory()) {
    throwDirectoryError(fullPath);
  }
};

const existsAndWithinBase = (basePath: string) => async ({ fullPath }: { fullPath: string }): Promise<boolean> => {
  if (!isPathWithinBase(basePath)(fullPath)) { return false; }

  try {
    await checkFileExists(fullPath);
    return true;
  } catch (err: unknown) {
    if (isFileNotFoundError(err)) {
      try {
        await stat(basePath);
        return false;
      } catch {
        throwBasePathNotFoundError(basePath, err);
      }
    }
    throw makeFilesystemError(fullPath, String(err));
  }
};

const findFileInSearchPaths = async (searchPaths: string[], name: string): Promise<string | null> => {
  for (const searchPath of searchPaths) {
    const { basePath, fullPath } = resolveFromSearchPath(name)(searchPath);
    if (await existsAndWithinBase(basePath)({ fullPath })) {
      return fullPath;
    }
  }
  return null;
};

const readFileSource = async (fullPath: string): Promise<FileSystemLoaderSource | null> => {
  try {
    return {
      src: await readFile(fullPath, 'utf-8'),
      path: fullPath
    };
  } catch (err: unknown) {
    if (isFileNotFoundError(err)) { return null; }
    throw makeFilesystemError(fullPath, String(err));
  }
};

const normalizeFilePath = (p: string) => path.resolve(path.normalize(p));

const isFileChangeEvent = (eventType: string) => eventType === 'change' || eventType === 'rename';

const createFileCacheInvalidator = (cache: Record<string, unknown>) => (normalizedPath: string) => {
  forEach(
    filter(
      entries(cache),
      ([, tmpl]) => Boolean(tmpl && typeof tmpl === 'object' && 'path' in tmpl && normalizeFilePath((tmpl as { path: string }).path) === normalizedPath),
    ),
    ([key]) => { cache[key] = null; }
  );
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

const setupLoaderGetSource = (loader: FileSystemLoader) => {
  loader.getSource = async (name: string): Promise<FileSystemLoaderSource | null> => {
    const fullPath = await findFileInSearchPaths(loader.searchPaths, name);
    if (!fullPath) { return null; }

    loader.pathsToNames[fullPath] = name;
    if (loader.watchEnabled) { loader.watchFile(fullPath); }

    const source = await readFileSource(fullPath);
    loader.emit('load', name, source);
    return source;
  };
};

const setupLoaderWatch = (loader: FileSystemLoader) => {
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
    for (const watcher of loader.watchedFiles.values()) {
      watcher.close();
    }
    loader.watchedFiles.clear();
  };
};

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

  setupLoaderGetSource(loader);
  setupLoaderWatch(loader);

  return loader;
}

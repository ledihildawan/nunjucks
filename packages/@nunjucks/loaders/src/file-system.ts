import { isArray, forEach } from 'remeda';
import { readFile, stat, realpath } from 'node:fs/promises';
import { watch, type FSWatcher, type Stats } from 'node:fs';
import path from 'node:path';
import { createLoader, type Loader } from './base.ts';
import { getError, createLog } from '@nunjucks/log';

const normalizeSearchPaths = (searchPaths: string | string[] | undefined): string[] => {
  if (!searchPaths) {
    return ['.'];
  }
  if (isArray(searchPaths)) {
    return searchPaths.map(path.normalize);
  }
  return [path.normalize(searchPaths)];
};

const resolveFromSearchPath = (name: string) => (searchPath: string) => {
  const basePath = path.resolve(searchPath);
  const fullPath = path.resolve(searchPath, name);
  return { basePath, fullPath };
};

const makeFilesystemError = (targetPath: string, message: string) =>
  createLog('error', { def: getError('FILESYSTEM_ERROR'), params: { msg: message }, subject: targetPath, context: { phase: 'load' } });

const throwDirectoryError = (fullPath: string): never => {
  throw makeFilesystemError(fullPath, `EISDIR: illegal operation - path is a directory: ${fullPath}`);
};

const hasErrorCode = (err: unknown): err is { code: string } =>
  err !== null && typeof err === 'object' && 'code' in err;

const isFileNotFoundError = (err: unknown): boolean =>
  hasErrorCode(err) && err.code === 'ENOENT';

const throwBasePathNotFoundError = (basePath: string, baseErr: unknown): never => {
  const message = isFileNotFoundError(baseErr)
    ? `ENOENT: no such file or directory: ${basePath}`
    : String(baseErr);
  throw makeFilesystemError(basePath, message);
};

const containsNullByte = (name: string): boolean => name.includes('\0');

const isWithinBase = (basePath: string, fullPath: string): boolean => {
  const relative = path.relative(basePath, fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const resolveRealPaths = async (basePath: string, fullPath: string): Promise<{ realBase: string; realFull: string }> => {
  const [realBase, realFull] = await Promise.all([realpath(basePath), realpath(fullPath)]);
  return { realBase, realFull };
};

const existsAndWithinBase = async (basePath: string, fullPath: string): Promise<boolean> => {
  let fileStat: Stats;
  try {
    fileStat = await stat(fullPath);
  } catch (err: unknown) {
    if (isFileNotFoundError(err)) {
      try {
        await stat(basePath);
        return false;
      } catch (baseErr) {
        throwBasePathNotFoundError(basePath, baseErr);
      }
    }
    throw makeFilesystemError(fullPath, String(err));
  }

  if (fileStat.isDirectory()) {
    throwDirectoryError(fullPath);
  }

  // WHY: containment is checked on realpath-resolved values so symlinks inside the base that point outside are rejected; the earlier startsWith check could be defeated by a sibling directory sharing a name prefix (e.g. /app/templates vs /app/templates-secret).
  // WHY: realpath failure after stat-success (EACCES/ELOOP) means containment cannot be verified — fail closed (treat as not loadable) rather than risk serving a path that escapes the base.
  try {
    const { realBase, realFull } = await resolveRealPaths(basePath, fullPath);
    return isWithinBase(realBase, realFull);
  } catch {
    return false;
  }
};

const findFileInSearchPaths = async (searchPaths: readonly string[], name: string): Promise<string | null> => {
  const [first, ...rest] = searchPaths;
  if (first === undefined) { return null; }
  const { basePath, fullPath } = resolveFromSearchPath(name)(first);
  if (await existsAndWithinBase(basePath, fullPath)) {
    return fullPath;
  }
  return findFileInSearchPaths(rest, name);
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

const isFileChangeEvent = (eventType: string) => eventType === 'change' || eventType === 'rename';

interface CreateWatchHandlerOptions {
  filePath: string;
  emit: (event: string, ...args: unknown[]) => void;
  onRename: (filePath: string) => void;
}

const createWatchHandler = ({ filePath, emit, onRename }: CreateWatchHandlerOptions) =>
  (eventType: string, filename: string | null) => {
    if (!isFileChangeEvent(eventType)) { return; }

    emit('update', filename ?? filePath, filePath);

    if (eventType === 'rename') { onRename(filePath); }
  };

export interface FileSystemLoaderSource {
  src: string;
  path: string;
}

export interface FileSystemLoaderOptions {
  watch?: boolean;
}

export interface FileSystemLoader extends Loader {
  pathsToNames: Map<string, string>;
  watchEnabled: boolean;
  async: true;
  watchedFiles: Map<string, FSWatcher>;
  searchPaths: string[];
  getSource: (name: string) => Promise<FileSystemLoaderSource | null>;
  watchFile: (filePath: string) => void;
  unwatchFile: (filePath: string) => void;
  unwatchAll: () => void;
}

export const createFileSystemLoader = (searchPaths: string | string[] | undefined, options: FileSystemLoaderOptions = {}): FileSystemLoader => {
  const base = createLoader();
  const normalizedSearchPaths = normalizeSearchPaths(searchPaths);
  const watchedFiles = new Map<string, FSWatcher>();
  const pathsToNames = new Map<string, string>();
  const watchEnabled = Boolean(options.watch);

  const unwatchFile = (filePath: string): void => {
    const watcher = watchedFiles.get(filePath);
    if (watcher) {
      watcher.close();
      watchedFiles.delete(filePath);
    }
  };

  const watchFile = (filePath: string): void => {
    if (watchedFiles.has(filePath)) { return; }

    const watcher = watch(filePath, createWatchHandler({ filePath, emit: base.emit, onRename: unwatchFile }));
    watchedFiles.set(filePath, watcher);
  };

  const unwatchAll = (): void => {
    forEach(Array.from(watchedFiles.values()), (watcher) => watcher.close());
    watchedFiles.clear();
  };

  const getSource = async (name: string): Promise<FileSystemLoaderSource | null> => {
    if (containsNullByte(name)) { return null; }

    const fullPath = await findFileInSearchPaths(normalizedSearchPaths, name);
    if (!fullPath) { return null; }

    pathsToNames.set(fullPath, name);
    if (watchEnabled) { watchFile(fullPath); }

    const source = await readFileSource(fullPath);
    base.emit('load', name, source);
    return source;
  };

  return {
    ...base,
    pathsToNames,
    watchEnabled,
    async: true,
    watchedFiles,
    searchPaths: normalizedSearchPaths,
    getSource,
    watchFile,
    unwatchFile,
    unwatchAll,
  };
};

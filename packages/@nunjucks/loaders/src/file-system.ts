import { isArray, forEach } from 'remeda';
import { readFile, stat, realpath } from 'node:fs/promises';
import { watch, type FSWatcher, type Stats } from 'node:fs';
import path from 'node:path';
import { createLoader, type Loader } from './base.ts';
import { getError, createLog } from '@nunjucks/log';
import { ok, err, type Result } from '@nunjucks/lib';
import type { TemplateError } from '@nunjucks/log';
import { containsNullByte, isWithinBase } from '@nunjucks/shared/security';

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

const makeFilesystemError = (targetPath: string, message: string): TemplateError =>
  createLog('error', { def: getError('FILESYSTEM_ERROR'), params: { msg: message }, subject: targetPath, context: { phase: 'load' } });

const directoryError = (fullPath: string): Result<never, TemplateError> =>
  err(makeFilesystemError(fullPath, `EISDIR: illegal operation - path is a directory: ${fullPath}`));

const hasErrorCode = (e: unknown): e is { code: string } =>
  e !== null && typeof e === 'object' && 'code' in e;

const isFileNotFoundError = (e: unknown): boolean =>
  hasErrorCode(e) && e.code === 'ENOENT';

const basePathNotFoundError = (basePath: string, baseErr: unknown): Result<never, TemplateError> => {
  const message = isFileNotFoundError(baseErr)
    ? `ENOENT: no such file or directory: ${basePath}`
    : String(baseErr);
  return err(makeFilesystemError(basePath, message));
};

const resolveRealPaths = async (basePath: string, fullPath: string): Promise<{ realBase: string; realFull: string }> => {
  const [realBase, realFull] = await Promise.all([realpath(basePath), realpath(fullPath)]);
  return { realBase, realFull };
};

const existsAndWithinBase = async (basePath: string, fullPath: string): Promise<Result<boolean, TemplateError>> => {
  let fileStat: Stats;
  try {
    fileStat = await stat(fullPath);
  } catch (e: unknown) {
    if (isFileNotFoundError(e)) {
      try {
        await stat(basePath);
        return ok(false);
      } catch (baseErr) {
        return basePathNotFoundError(basePath, baseErr);
      }
    }
    return err(makeFilesystemError(fullPath, String(e)));
  }

  if (fileStat.isDirectory()) {
    return directoryError(fullPath);
  }

  try {
    const { realBase, realFull } = await resolveRealPaths(basePath, fullPath);
    return ok(isWithinBase(realBase, realFull));
  } catch {
    return ok(false);
  }
};

const findFileInSearchPaths = async (searchPaths: readonly string[], name: string): Promise<Result<string, TemplateError> | null> => {
  const [first, ...rest] = searchPaths;
  if (first === undefined) { return null; }
  const { basePath, fullPath } = resolveFromSearchPath(name)(first);
  const result = await existsAndWithinBase(basePath, fullPath);
  if (!result.ok) { return result; }
  return result.value ? ok(fullPath) : findFileInSearchPaths(rest, name);
};

const readFileSource = async (fullPath: string): Promise<Result<FileSystemLoaderSource, TemplateError>> => {
  try {
    return ok({
      src: await readFile(fullPath, 'utf-8'),
      path: fullPath
    });
  } catch (e: unknown) {
    if (isFileNotFoundError(e)) { return ok({ src: '', path: fullPath }); }
    return err(makeFilesystemError(fullPath, String(e)));
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
  getSource: (name: string) => Promise<Result<FileSystemLoaderSource, TemplateError> | null>;
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

  const getSource = async (name: string): Promise<Result<FileSystemLoaderSource, TemplateError> | null> => {
    if (containsNullByte(name)) { return null; }

    const pathResult = await findFileInSearchPaths(normalizedSearchPaths, name);
    if (pathResult === null) { return null; }
    if (!pathResult.ok) { return err(pathResult.error); }

    const fullPath = pathResult.value;
    pathsToNames.set(fullPath, name);
    if (watchEnabled) { watchFile(fullPath); }

    const sourceResult = await readFileSource(fullPath);
    if (!sourceResult.ok) { return err(sourceResult.error); }

    const source = sourceResult.value;
    if (source.src === '') { return null; }

    base.emit('load', name, source);
    return ok(source);
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

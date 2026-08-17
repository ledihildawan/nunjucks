import { type FSWatcher, type Stats, watch } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { containsNullByte, err, isWithinBase, ok, type Result } from '@nunjucks/lib';
import { isArray } from 'remeda';
import { createLoader, type Loader } from './base.ts';
import type { TemplateLoader, TemplateLoaderSource } from './loader-chain.ts';
import { createSourceMemo } from './source-memo.ts';

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

const createFilesystemError = (targetPath: string, message: string): TemplateError =>
  createLog('error', {
    def: getError('FILESYSTEM_ERROR'),
    params: { msg: message },
    subject: targetPath,
    context: { phase: 'load' },
  });

const directoryError = (fullPath: string): Result<never, TemplateError> =>
  err(
    createFilesystemError(fullPath, `EISDIR: illegal operation - path is a directory: ${fullPath}`)
  );

const createWatchError = (filePath: string, cause: unknown): TemplateError =>
  createFilesystemError(filePath, `watch failed: ${String(cause)}`);

const hasErrorCode = (e: unknown): e is { code: string } =>
  e !== null && typeof e === 'object' && 'code' in e;

const isFileNotFoundError = (e: unknown): boolean => hasErrorCode(e) && e.code === 'ENOENT';

const basePathNotFoundError = (
  basePath: string,
  baseErr: unknown
): Result<never, TemplateError> => {
  const message = isFileNotFoundError(baseErr)
    ? `ENOENT: no such file or directory: ${basePath}`
    : String(baseErr);
  return err(createFilesystemError(basePath, message));
};

const resolveRealPaths = async (
  basePath: string,
  fullPath: string
): Promise<Result<{ realBase: string; realFull: string }, TemplateError>> => {
  try {
    const [realBase, realFull] = await Promise.all([realpath(basePath), realpath(fullPath)]);
    return ok({ realBase, realFull });
  } catch (e: unknown) {
    return err(createFilesystemError(fullPath, `realpath failed: ${String(e)}`));
  }
};

const existsAndWithinBase = async (
  basePath: string,
  fullPath: string
): Promise<Result<boolean, TemplateError>> => {
  let fileStat: Stats;
  try {
    fileStat = await stat(fullPath);
  } catch (e: unknown) {
    if (isFileNotFoundError(e)) {
      try {
        await stat(basePath);
        return ok(false);
      } catch (baseErr: unknown) {
        return basePathNotFoundError(basePath, baseErr);
      }
    }
    return err(createFilesystemError(fullPath, String(e)));
  }

  if (fileStat.isDirectory()) {
    return directoryError(fullPath);
  }

  const realPathResult = await resolveRealPaths(basePath, fullPath);
  if (!realPathResult.ok) {
    return err(realPathResult.error);
  }
  return ok(isWithinBase(realPathResult.value.realBase, realPathResult.value.realFull));
};

const findFileInSearchPaths = async (
  searchPaths: readonly string[],
  name: string
): Promise<Result<string, TemplateError> | null> => {
  const [first, ...rest] = searchPaths;
  if (first === undefined) {
    return null;
  }
  const { basePath, fullPath } = resolveFromSearchPath(name)(first);
  const result = await existsAndWithinBase(basePath, fullPath);
  if (result.ok && !result.value) {
    return findFileInSearchPaths(rest, name);
  }
  if (!result.ok) {
    return err(result.error);
  }
  return ok(fullPath);
};

const readFileSource = async (
  fullPath: string
): Promise<Result<{ path: string; src: string } | null, TemplateError>> => {
  try {
    return ok({
      src: await readFile(fullPath, 'utf-8'),
      path: fullPath,
    });
  } catch (e: unknown) {
    if (isFileNotFoundError(e)) {
      return ok(null);
    }
    return err(createFilesystemError(fullPath, String(e)));
  }
};

const isFileChangeEvent = (eventType: string) => eventType === 'change' || eventType === 'rename';

interface CreateWatchHandlerOptions {
  filePath: string;
  emit: (event: string, ...args: unknown[]) => void;
  onRename: (filePath: string) => void;
}

const createWatchHandler =
  ({ filePath, emit, onRename }: CreateWatchHandlerOptions) =>
  (eventType: string, filename: string | null) => {
    if (!isFileChangeEvent(eventType)) {
      return;
    }

    emit('update', filename ?? filePath, filePath);

    if (eventType === 'rename') {
      onRename(filePath);
    }
  };

interface FileSystemLoaderOptions {
  watch?: boolean;
  // WHY: source memo — see source-memo.ts; false restores the always-verify path.
  memo?: boolean;
}

export interface FileSystemLoader extends Loader, TemplateLoader {
  pathsToNames: Map<string, string>;
  watchEnabled: boolean;
  async: true;
  watchedFiles: Map<string, FSWatcher>;
  searchPaths: string[];
  watchFile: (filePath: string) => void;
  unwatchFile: (filePath: string) => void;
  unwatchAll: () => void;
}

/**
 * Creates the filesystem template loader — the engine's primary I/O shell for
 * resolving template sources from disk.
 *
 * Resolution walks `searchPaths` in order (first match wins). Every hit is
 * re-validated via realpath so symlinks cannot escape the search root, and
 * resolved sources are memoized per `(mtimeMs, size)` until the file changes.
 *
 * @param searchPaths - Directory, or ordered list of directories, to resolve
 *   template names against. Defaults to `['.']`.
 * @param options - `watch` (default `false`) attaches an fs watcher per
 *   resolved file and emits `update` events on change/rename; `memo`
 *   (default `true`) enables the stat-validated source memo — `false`
 *   restores the always-verify path.
 * @returns A loader whose `getSource` resolves to `ok(source)` on hit, `null`
 *   on miss, or `err(TemplateError)` on filesystem failure. Watcher failures
 *   never throw — they surface as catalog `TemplateError`s on the loader's
 *   `error` event channel.
 */
export const createFileSystemLoader = (
  searchPaths: string | string[] | undefined,
  options: FileSystemLoaderOptions = {}
): FileSystemLoader => {
  const base = createLoader();
  const normalizedSearchPaths = normalizeSearchPaths(searchPaths);
  const watchedFiles = new Map<string, FSWatcher>();
  const pathsToNames = new Map<string, string>();
  const watchEnabled = Boolean(options.watch);
  const memoEnabled = options.memo !== false;
  const sourceMemo = memoEnabled ? createSourceMemo() : null;

  const unwatchFile = (filePath: string): void => {
    const watcher = watchedFiles.get(filePath);
    if (watcher) {
      watcher.close();
      watchedFiles.delete(filePath);
    }
  };

  const watchFile = (filePath: string): void => {
    if (watchedFiles.has(filePath)) {
      return;
    }

    let watcher: FSWatcher;
    try {
      watcher = watch(
        filePath,
        createWatchHandler({ filePath, emit: base.emit, onRename: unwatchFile })
      );
    } catch (watchSetupError: unknown) {
      // WHY: the loader's error channel carries catalog TemplateErrors everywhere —
      // watch failures are wrapped so listeners never see a raw fs error shape.
      base.emit('error', createWatchError(filePath, watchSetupError));
      return;
    }

    // WHY: a failed watcher is deleted from the registry — watchFile early-returns on
    // known paths, so keeping the dead entry would block any future re-watch attempt
    // for the lifetime of the loader.
    watcher.on('error', (watchFailure: unknown) => {
      watchedFiles.delete(filePath);
      base.emit('error', createWatchError(filePath, watchFailure));
    });
    watchedFiles.set(filePath, watcher);
  };

  const unwatchAll = (): void => {
    // WHY: imperative teardown sequence — each watcher.close() is an independent
    // side-effectful cleanup; no data is transformed between iterations.
    for (const watcher of watchedFiles.values()) {
      watcher.close();
    }
    watchedFiles.clear();
  };

  const readVerifiedSource = async (
    name: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    const pathResult = await findFileInSearchPaths(normalizedSearchPaths, name);
    if (pathResult === null) {
      return null;
    }
    if (!pathResult.ok) {
      return err(pathResult.error);
    }

    const fullPath = pathResult.value;
    pathsToNames.set(fullPath, name);
    if (watchEnabled) {
      watchFile(fullPath);
    }

    const sourceResult = await readFileSource(fullPath);
    if (!sourceResult.ok) {
      return err(sourceResult.error);
    }
    if (sourceResult.value === null) {
      return null;
    }

    const source: TemplateLoaderSource = { ...sourceResult.value };
    if (sourceMemo) {
      await sourceMemo.remember(fullPath, source);
    }
    return ok(source);
  };

  const getSource = async (
    name: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    if (containsNullByte(name)) {
      return null;
    }
    const memoHit = sourceMemo ? await sourceMemo.consult(normalizedSearchPaths, name) : null;
    if (memoHit !== null) {
      return memoHit.ok ? ok(memoHit.value) : err(memoHit.error);
    }
    const verified = await readVerifiedSource(name);
    if (verified === null || !verified.ok) {
      return verified;
    }
    base.emit('load', name, verified.value);
    return ok(verified.value);
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

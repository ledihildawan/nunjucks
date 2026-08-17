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
  // WHY: source memo — repeated getSource calls for an unchanged file answer from
  // memory after a single stat() revalidation instead of the full verification pass
  // (stat + realpath x2 + readFile). A rewritten file (different mtimeMs/size) always
  // takes the full path, so traversal containment is re-proven after any change.
  memo?: boolean;
}

// WHY: memo identity = (mtimeMs, size) — the same pair filesystems use to detect
// modification; content equality follows because any real write updates mtime.
interface MemoizedSource {
  readonly source: TemplateLoaderSource;
  readonly mtimeMs: number;
  readonly size: number;
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
  const sourceMemo = new Map<string, MemoizedSource>();

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

  // WHY: revalidation touch — one stat() on the full path. Same mtime+size means the
  // memoized source (already traversal-proven) is still valid; any difference falls
  // through to the full verification pass. ENOENT on revalidation means the file was
  // deleted — drop the memo and treat it as a miss.
  const readMemoizedSource = async (
    fullPath: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    const memoized = sourceMemo.get(fullPath);
    if (!memoized) {
      return null;
    }
    try {
      const currentStat = await stat(fullPath);
      if (
        currentStat.mtimeMs === memoized.mtimeMs &&
        currentStat.size === memoized.size
      ) {
        return ok(memoized.source);
      }
    } catch {
      sourceMemo.delete(fullPath);
      return null;
    }
    sourceMemo.delete(fullPath);
    return null;
  };

  const getSource = async (
    name: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    if (containsNullByte(name)) {
      return null;
    }

    if (memoEnabled) {
      const memoKey = path.resolve(
        normalizedSearchPaths.find(
          (searchPath) => sourceMemo.has(path.resolve(searchPath, name))
        ) ?? normalizedSearchPaths[0] ?? '.',
        name
      );
      const memoHit = await readMemoizedSource(memoKey);
      if (memoHit !== null) {
        if (!memoHit.ok) {
          return err(memoHit.error);
        }
        base.emit('load', name, memoHit.value);
        return ok(memoHit.value);
      }
    }

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
    if (memoEnabled) {
      try {
        const fileStat = await stat(fullPath);
        sourceMemo.set(fullPath, {
          source,
          mtimeMs: fileStat.mtimeMs,
          size: fileStat.size,
        });
      } catch {
        // WHY: memo population is best-effort — a stat race right after read falls
        // back to the always-correct uncached path on the next call.
      }
    }
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

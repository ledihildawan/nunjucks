import { type FSWatcher, type Stats, watch } from 'node:fs';
import { constants, type FileHandle, open } from 'node:fs/promises';
import path from 'node:path';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { createLoader, type Loader } from './base.ts';
import type { TemplateLoader, TemplateLoaderSource } from './loader-chain.ts';
import { containsNullByte } from './path-security.ts';
import { createFilesystemError, findFileInSearchPaths } from './path-validation.ts';
import { createSourceMemo } from './source-memo.ts';

const normalizeSearchPaths = (searchPaths: string | string[] | undefined): string[] => {
  if (!searchPaths) {
    return ['.'];
  }
  if (Array.isArray(searchPaths)) {
    return searchPaths.map(path.normalize);
  }
  return [path.normalize(searchPaths)];
};

const hasErrorCode = (e: unknown): e is { code: string } =>
  e !== null && typeof e === 'object' && 'code' in e;

const isFileNotFoundError = (e: unknown): boolean => hasErrorCode(e) && e.code === 'ENOENT';

const createWatchError = (filePath: string, cause: unknown): TemplateError =>
  createFilesystemError(filePath, `watch failed: ${String(cause)}`);

// WHY: O_NOFOLLOW makes open refuse a symlink swapped onto the validated path
// (ELOOP) at open time — undefined on Windows, where 0 falls back to a plain
// open and the dev/ino identity check below is the swap detector.
const noFollowFlags: number = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

// WHY: `swapped` marks a dev/ino mismatch against the validation stats — benign
// atomic-rename writers self-heal via the caller's single retry; `null` keeps
// ENOENT-as-miss; the fd Stats ride along as the strongest pre-read identity
// snapshot (same inode the bytes are read from) for the memo.
type HandleRead = { swapped: true } | { swapped: false; src: string; stats: Stats };

const readThroughHandle = async (
  realFull: string,
  validationStats: Stats
): Promise<Result<HandleRead | null, TemplateError>> => {
  let handle: FileHandle | undefined;
  try {
    handle = await open(realFull, noFollowFlags);
    const fdStats = await handle.stat();
    if (
      fdStats.isSymbolicLink() ||
      fdStats.dev !== validationStats.dev ||
      fdStats.ino !== validationStats.ino
    ) {
      return ok({ swapped: true });
    }
    return ok({ swapped: false, src: await handle.readFile('utf-8'), stats: fdStats });
  } catch (readErr: unknown) {
    if (isFileNotFoundError(readErr)) {
      return ok(null);
    }
    return err(createFilesystemError(realFull, String(readErr)));
  } finally {
    // WHY: close on every path — a leaked descriptor per getSource would exhaust
    // the process fd budget; close failures are inert once content is settled.
    await handle?.close().catch(() => undefined);
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

/**
 * Filesystem loader surface: the `Loader`/`TemplateLoader` contract plus the
 * watcher registry and search-path bookkeeping needed to inspect and tear down
 * live watchers.
 */
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
 * re-validated via realpath so symlinks cannot escape the search root, read
 * through a no-follow descriptor identity-checked against the validation
 * stat (dev/ino), and memoized per `(mtimeMs, size)` until the file changes.
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

  type VerifiedReadOutcome = {
    swapped: boolean;
    result: Result<TemplateLoaderSource, TemplateError> | null;
  };

  const attemptVerifiedRead = async (name: string): Promise<VerifiedReadOutcome> => {
    const pathResult = await findFileInSearchPaths(normalizedSearchPaths, name);
    if (pathResult === null) {
      return { swapped: false, result: null };
    }
    if (!pathResult.ok) {
      return { swapped: false, result: err(pathResult.error) };
    }

    const { fullPath, realFull, stats } = pathResult.value;
    pathsToNames.set(fullPath, name);
    if (watchEnabled) {
      watchFile(fullPath);
    }

    // WHY: read through a no-follow descriptor pinned at open — readFile(realFull)
    // re-resolves the path and follows a symlink swapped in between validation and
    // read (the residual TOCTOU window); the reported path stays fullPath.
    const sourceResult = await readThroughHandle(realFull, stats);
    if (!sourceResult.ok) {
      return { swapped: false, result: err(sourceResult.error) };
    }
    if (sourceResult.value === null) {
      return { swapped: false, result: null };
    }
    if (sourceResult.value.swapped) {
      return { swapped: true, result: null };
    }

    const source: TemplateLoaderSource = {
      path: fullPath,
      src: sourceResult.value.src,
    };
    if (sourceMemo) {
      await sourceMemo.remember(fullPath, source, sourceResult.value.stats);
    }
    return { swapped: false, result: ok(source) };
  };

  const readVerifiedSource = async (
    name: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    const first = await attemptVerifiedRead(name);
    if (!first.swapped) {
      return first.result;
    }
    // WHY: exactly one retry — an atomic-rename writer (editor save) legitimately
    // replaces the file between validation and open, and a fresh resolution picks
    // up the new inode; a second mismatch fails closed because the bytes are then
    // not provably the validated file's.
    const second = await attemptVerifiedRead(name);
    return second.swapped
      ? err(
          createFilesystemError(
            name,
            `validation race: file identity changed between validation and read: ${name}`
          )
        )
      : second.result;
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

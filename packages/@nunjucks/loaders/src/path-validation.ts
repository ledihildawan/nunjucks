import type { Stats } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { isWithinBase } from './path-security.ts';

// WHY: path validation — stat + realpath containment + the search-path scan.
// Extracted from file-system.ts to keep both modules under the size/complexity
// caps (same rationale as source-memo.ts); the error-shape helpers live here
// because validation outcomes are their primary producer.

const createFilesystemError = (targetPath: string, message: string): TemplateError =>
  createLog('error', {
    def: getError('FILESYSTEM_ERROR'),
    params: { msg: message },
    subject: targetPath,
    context: { phase: 'load' },
  });

export { createFilesystemError };

const directoryError = (fullPath: string): Result<never, TemplateError> =>
  err(
    createFilesystemError(fullPath, `EISDIR: illegal operation - path is a directory: ${fullPath}`)
  );

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
  } catch (realpathErr: unknown) {
    return err(createFilesystemError(fullPath, `realpath failed: ${String(realpathErr)}`));
  }
};

// WHY: stats ride with validation — captured BEFORE the read so the descriptor
// read in file-system.ts can prove it opened the exact inode validation statted
// (dev/ino), never a path swapped in between.
type PathValidation = { exists: false } | { exists: true; realFull: string; stats: Stats };

const existsAndWithinBase = async (
  basePath: string,
  fullPath: string
): Promise<Result<PathValidation, TemplateError>> => {
  let fileStat: Stats;
  try {
    fileStat = await stat(fullPath);
  } catch (statErr: unknown) {
    if (isFileNotFoundError(statErr)) {
      try {
        await stat(basePath);
        return ok({ exists: false });
      } catch (baseErr: unknown) {
        return basePathNotFoundError(basePath, baseErr);
      }
    }
    return err(createFilesystemError(fullPath, String(statErr)));
  }

  if (fileStat.isDirectory()) {
    return directoryError(fullPath);
  }

  const realPathResult = await resolveRealPaths(basePath, fullPath);
  if (!realPathResult.ok) {
    return err(realPathResult.error);
  }
  const { realBase, realFull } = realPathResult.value;
  return ok({ exists: isWithinBase(realBase, realFull), realFull, stats: fileStat });
};

const resolveFromSearchPath = (name: string) => (searchPath: string) => {
  const basePath = path.resolve(searchPath);
  const fullPath = path.resolve(searchPath, name);
  return { basePath, fullPath };
};

export const findFileInSearchPaths = async (
  searchPaths: readonly string[],
  name: string
): Promise<Result<{ fullPath: string; realFull: string; stats: Stats }, TemplateError> | null> => {
  const [first, ...rest] = searchPaths;
  if (first === undefined) {
    return null;
  }
  const { basePath, fullPath } = resolveFromSearchPath(name)(first);
  const result = await existsAndWithinBase(basePath, fullPath);
  if (!result.ok) {
    return err(result.error);
  }
  if (!result.value.exists) {
    return findFileInSearchPaths(rest, name);
  }
  return ok({ fullPath, realFull: result.value.realFull, stats: result.value.stats });
};

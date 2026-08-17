import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result } from '@nunjucks/lib';
import type { TemplateLoaderSource } from './loader-chain.ts';

// WHY: source memo — repeated getSource calls for an unchanged file answer from
// memory after a single stat() revalidation instead of the full verification pass
// (stat + realpath x2 + readFile). A rewritten file (different mtimeMs/size) always
// takes the full path, so traversal containment is re-proven after any change.
// Extracted from file-system.ts to keep both modules under the size/complexity caps.

// WHY: memo identity = (mtimeMs, size) — the same pair filesystems use to detect
// modification; content equality follows because any real write updates mtime.
interface MemoizedSource {
  readonly source: TemplateLoaderSource;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface SourceMemo {
  consult: (
    searchPaths: readonly string[],
    name: string
  ) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
  remember: (fullPath: string, source: TemplateLoaderSource) => Promise<void>;
}

export const createSourceMemo = (): SourceMemo => {
  const entries = new Map<string, MemoizedSource>();

  // WHY: revalidation touch — one stat() on the full path. Same mtime+size means the
  // memoized source (already traversal-proven) is still valid; any difference falls
  // through to the full verification pass. ENOENT on revalidation means the file was
  // deleted — drop the memo and treat it as a miss.
  const revalidate = async (
    fullPath: string
  ): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
    const memoized = entries.get(fullPath);
    if (!memoized) {
      return null;
    }
    try {
      const currentStat = await stat(fullPath);
      if (currentStat.mtimeMs === memoized.mtimeMs && currentStat.size === memoized.size) {
        return ok(memoized.source);
      }
    } catch {
      entries.delete(fullPath);
      return null;
    }
    entries.delete(fullPath);
    return null;
  };

  return {
    consult: async (searchPaths, name) => {
      const memoPath = searchPaths.find((searchPath) =>
        entries.has(path.resolve(searchPath, name))
      );
      return memoPath !== undefined ? revalidate(path.resolve(memoPath, name)) : null;
    },
    remember: async (fullPath, source) => {
      try {
        const fileStat = await stat(fullPath);
        entries.set(fullPath, { source, mtimeMs: fileStat.mtimeMs, size: fileStat.size });
      } catch {
        // WHY: memo population is best-effort — a stat race right after read falls
        // back to the always-correct uncached path on the next call.
      }
    },
  };
};

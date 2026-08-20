import type { Stats } from 'node:fs';
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

const hasErrorCode = (e: unknown): e is { code: string } =>
  e !== null && typeof e === 'object' && 'code' in e;

const isEnoent = (e: unknown): boolean => hasErrorCode(e) && e.code === 'ENOENT';

// WHY: single-search-path probe outcome — `next` means ENOENT (move on to the next
// path); `answer` ends the scan because an existing file — or a hard stat error —
// settles precedence at this path either way.
type ProbeOutcome =
  | { readonly kind: 'next' }
  | { readonly kind: 'answer'; answer: Result<TemplateLoaderSource, TemplateError> | null };

/**
 * Defines the source-memo surface: `consult` answers from memory only when a
 * fresh `stat` still matches the memoized `(mtimeMs, size)` pair, while
 * `remember` records a traversal-proven source keyed by resolved full path
 * together with the stats captured before the content read.
 */
export interface SourceMemo {
  consult: (
    searchPaths: readonly string[],
    name: string
  ) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
  remember: (fullPath: string, source: TemplateLoaderSource, stats: Stats) => Promise<void>;
}

/**
 * Creates an in-memory source memo keyed by resolved full path. A hit
 * requires the current `stat` to match the memoized `(mtimeMs, size)` — any
 * difference or ENOENT deletes the entry, deferring to the full
 * verification pass on the next consult.
 */
export const createSourceMemo = (): SourceMemo => {
  const entries = new Map<string, MemoizedSource>();

  // WHY: exactly one stat per probed search path — 'next' on ENOENT moves on to the
  // next path; any other outcome ends the scan because an existing file (or a hard
  // stat error) settles precedence at this path either way.
  const probeSearchPath = async (fullPath: string): Promise<ProbeOutcome> => {
    const memoized = entries.get(fullPath);
    try {
      const currentStat = await stat(fullPath);
      if (
        memoized !== undefined &&
        currentStat.mtimeMs === memoized.mtimeMs &&
        currentStat.size === memoized.size
      ) {
        return { kind: 'answer', answer: ok(memoized.source) };
      }
      if (memoized !== undefined) {
        entries.delete(fullPath);
      }
      // WHY: the file exists here but no unchanged entry is keyed at this path —
      // fall through to full resolution rather than serving a lower-precedence hit.
      return { kind: 'answer', answer: null };
    } catch (statErr) {
      if (!isEnoent(statErr)) {
        // WHY: non-ENOENT failures defer to the full verification pass, which
        // re-runs the same stat and surfaces a catalogued TemplateError.
        return { kind: 'answer', answer: null };
      }
      if (memoized !== undefined) {
        entries.delete(fullPath);
      }
      return { kind: 'next' };
    }
  };

  return {
    // WHY: probe search paths in order, mirroring findFileInSearchPaths — the first
    // path holding an EXISTING file wins, not the first holding a memo entry. Keying
    // off memo entries alone would let a file created later at a higher-precedence
    // path never displace an older, lower-precedence hit, freezing stale content.
    consult: async (searchPaths, name) => {
      for (const searchPath of searchPaths) {
        const outcome = await probeSearchPath(path.resolve(searchPath, name));
        if (outcome.kind === 'next') {
          continue;
        }
        return outcome.answer;
      }
      return null;
    },
    remember: async (fullPath, source, stats) => {
      // WHY: stats come from the pre-read validation pass — stat'ing again after
      // the read would race a concurrent write into memoizing NEW (mtimeMs, size)
      // with OLD content, serving stale source until the next write.
      entries.set(fullPath, { source, mtimeMs: stats.mtimeMs, size: stats.size });
    },
  };
};

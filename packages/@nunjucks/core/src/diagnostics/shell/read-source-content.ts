import { readFile, stat } from 'node:fs/promises';

/**
 * Imperative-shell source reading for the diagnostics enrichment pipeline — the
 * ONLY `node:fs/promises` import allowed under `core/src/diagnostics/`. Pure
 * matchers (error-location, find-context-key-position) delegate here instead of
 * touching the filesystem themselves.
 */

// WHY: cap the bytes pulled from disk — mirrors project-source-reader's limit so
// a stack-frame path pointing at an oversized artifact (bundle, dump) cannot load
// it wholesale into the enrichment pipeline.
const MAX_SOURCE_BYTES = 1_000_000;

/**
 * Reads a UTF-8 source file, degrading to `null` on any failure (missing file,
 * permissions, EISDIR, oversized) — enrichment must never break the render
 * pipeline.
 */
export const readSourceContent = async (filePath: string): Promise<string | null> => {
  try {
    const { size } = await stat(filePath);
    if (size > MAX_SOURCE_BYTES) {
      return null;
    }
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
};

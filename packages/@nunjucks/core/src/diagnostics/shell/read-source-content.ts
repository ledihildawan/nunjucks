import { readFile } from 'node:fs/promises';

/**
 * Imperative-shell source reading for the diagnostics enrichment pipeline — the
 * ONLY `node:fs/promises` import allowed under `core/src/diagnostics/`. Pure
 * matchers (error-location, find-context-key-position) delegate here instead of
 * touching the filesystem themselves.
 */

/**
 * Reads a UTF-8 source file, degrading to `null` on any failure (missing file,
 * permissions, EISDIR) — enrichment must never break the render pipeline.
 */
export const readSourceContent = async (filePath: string): Promise<string | null> => {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
};

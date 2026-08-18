import { readFileSync, statSync } from 'node:fs';
import type { ProjectSourceContent, ProjectSourceLocation } from '@nunjucks/error-formatter';

// WHY: cap the bytes pulled from disk — the reader is dev-diagnostics only, but a
// stack-frame path pointing at an oversized artifact (bundle, dump) must not load it
// wholesale into the error-enrichment pipeline.
const MAX_PROJECT_SOURCE_BYTES = 1_000_000;

// WHY: deliberately synchronous — the public `formatError` (error-formatter) invokes
// `SourceFileReader` synchronously, so this shell reader matches that contract. It is
// the engine's only sync-fs site, quarantined here at the diagnostics shell boundary.
const isProjectSource = (path: string): boolean => {
  const normalized = path.replace(/\\/g, '/');
  return !normalized.includes('/node_modules/');
};

/** Reads a caller source for enrichment — skips `node_modules` and unreadable/oversized files. */
export const readProjectSource = (location: ProjectSourceLocation): ProjectSourceContent | null => {
  if (location.line === null || !isProjectSource(location.path)) {
    return null;
  }
  try {
    if (statSync(location.path).size > MAX_PROJECT_SOURCE_BYTES) {
      return null;
    }
    return {
      sourceContent: readFileSync(location.path, 'utf-8'),
      templatePath: location.path,
      lineno: location.line,
      colno: location.col ?? 1,
    };
  } catch {
    // WHY: nullable-reader contract — an unreadable source (permissions, deleted file, EISDIR)
    // degrades to "no project source" instead of failing the whole error-enrichment pipeline.
    return null;
  }
};

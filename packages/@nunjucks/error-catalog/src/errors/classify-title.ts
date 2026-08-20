// WHY: relative imports to the defining modules — importing from the package barrel
// (`@nunjucks/error-catalog`) creates an index.ts ⇄ classify-title.ts module cycle,
// since the barrel re-exports resolveHumanTitle from this file.

import { getErrorMessage } from '../get-error-message.ts';
import type { ErrorLike } from '../types.ts';
import { classifyFromError, replacePlaceholders } from './classify.ts';
import { ERROR_DEFINITIONS } from './registry.ts';
import type { HumanTitleInput } from './types.ts';

const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;

// WHY: imported from the catalog twin — the pattern IS the classify contract; a local
// literal copy could drift from the definition the classifier renders.
const RESERVED_KEYWORD_RE = ERROR_DEFINITIONS.RESERVED_KEYWORD.pattern;

// WHY: titles render from the catalog's titleTemplate — the single source of truth.
// A local literal copy could drift from the definition the classifier renders.
// Placeholder substitution goes through the classifier's own alias-aware helper so
// `{path}`-style templates interpolate identically here and in classify.ts.
const catalogTitle = (name: string, subject?: string): string | null => {
  const def = ERROR_DEFINITIONS[name as keyof typeof ERROR_DEFINITIONS];
  const template = def?.titleTemplate;
  if (template === undefined) {
    return null;
  }
  return replacePlaceholders({ template, undefinedName: subject ?? null });
};

/**
 * Resolves the human-facing title for a classified error by its catalog code NAME
 * (`'UNDEFINED_VARIABLE'`, …), preferring the catalog's `titleTemplate`; unknown
 * or unclassified errors fall back to `fallback`.
 */
const resolveHumanTitle = ({ name, undefinedName, plain, fallback }: HumanTitleInput): string => {
  const named = undefinedName ?? 'unknown';

  switch (name) {
    case 'UNDEFINED_VARIABLE':
      if (!undefinedName) {
        return fallback;
      }
      return catalogTitle('UNDEFINED_VARIABLE', undefinedName) ?? fallback;
    case 'UNDEFINED_FUNCTION':
      return catalogTitle('UNDEFINED_FUNCTION', named) ?? fallback;
    case 'UNDEFINED_FILTER':
      return catalogTitle('UNDEFINED_FILTER', named) ?? fallback;
    case 'IMPORT_ERROR':
      return catalogTitle('IMPORT_ERROR') ?? fallback;
    case 'FILE_NOT_FOUND':
      return catalogTitle('FILE_NOT_FOUND', named) ?? fallback;
    case 'SYNTAX_ERROR':
      return catalogTitle('SYNTAX_ERROR') ?? fallback;
    case 'TEMPLATE_MUST_BE_STRING':
      return catalogTitle('TEMPLATE_MUST_BE_STRING') ?? fallback;
    case 'RESERVED_KEYWORD_CONTEXT':
      return plain;
    case 'RESERVED_KEYWORD': {
      if (!RESERVED_KEYWORD_RE) {
        return fallback;
      }
      const match = plain.match(RESERVED_KEYWORD_RE);
      if (!match) {
        return fallback;
      }
      return `Cannot use reserved ${match[1]} '${match[2]}'`;
    }
    default:
      return fallback;
  }
};

/**
 * Classifies an error and derives its human title, extracting the undefined name from
 * the plain message when the classifier did not provide one.
 * This is a pure catalog function — it uses `getErrorMessage` (catalog) rather than
 * the renderer's `toText` so it can live in error-catalog without pulling in the
 * presentation layer.
 */
const classifyAndBuildTitle = (error: ErrorLike): string => {
  const classified = classifyFromError(error);
  const plain = getErrorMessage(error);
  const undefinedName = classified.undefinedName ?? plain.match(UNDEFINED_OUTPUT_RE)?.[1] ?? null;
  return resolveHumanTitle({
    name: classified.name,
    undefinedName,
    plain,
    fallback: classified.title ?? plain,
  });
};

export type { HumanTitleInput };
export { classifyAndBuildTitle, resolveHumanTitle };

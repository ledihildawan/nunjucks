import type { LineBase } from '@nunjucks/error-catalog';
import { classifyFromError, ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { mergeErrorParts } from './presentation/error/error-parts.ts';
import { toDisplayLocation } from './presentation/source-trace/location.ts';
import { escapeAttribute, escapeHtml } from './presentation/syntax-highlight/highlight.ts';
import type { ClassifiedError, ErrorLike, HumanTitleInput, LocationInfo } from './to-html-types.ts';
import { toText } from './to-text.ts';

const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;
// WHY: imported from the catalog twin — the pattern IS the classify contract; a local
// literal copy could drift from classification.
const RESERVED_KEYWORD_RE = ERROR_DEFINITIONS.RESERVED_KEYWORD.pattern;

/**
 * Renders an escaped badge chip, or `''` when the text is missing or empty.
 * `variant` interpolates into the class attribute, so it is escaped in
 * attribute context like every other dynamic attribute value.
 */
const renderBadge = (variant: string, text?: string | null): string => {
  if (!text) {
    return '';
  }
  return `<span class="badge ${escapeAttribute(variant)}">${escapeHtml(text)}</span>`;
};

// WHY: titles render from the catalog's titleTemplate — the single source of truth.
// A local literal copy could drift from the definition the classifier renders.
const catalogTitle = (name: keyof typeof ERROR_DEFINITIONS, subject?: string): string | null => {
  const template = ERROR_DEFINITIONS[name].titleTemplate;
  if (template === undefined) {
    return null;
  }
  return subject === undefined ? template : template.replaceAll('{name}', subject);
};

/**
 * Resolves the human-facing title for a classified error, preferring the catalog's
 * `titleTemplate` for known categories; unmatched categories fall back to `fallback`.
 */
const resolveHumanTitle = ({
  category,
  undefinedName,
  plain,
  fallback,
}: HumanTitleInput): string => {
  const named = undefinedName ?? 'unknown';

  switch (category) {
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
      return `Template file not found: ${named}`;
    case 'SYNTAX_ERROR':
      return catalogTitle('SYNTAX_ERROR') ?? fallback;
    case 'VALIDATION_ERROR':
      return catalogTitle('TEMPLATE_MUST_BE_STRING') ?? fallback;
    case 'RESERVED_KEYWORD_CONTEXT':
      return plain;
    case 'RESERVED_KEYWORD': {
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

/** Classifies an error via the catalog and merges attached parts into a display view. */
const classifyError = (error: ErrorLike): ClassifiedError => {
  const parts = mergeErrorParts(error);
  const classified = classifyFromError(error);
  return {
    category: error.code ?? classified.category.toUpperCase() ?? 'UNKNOWN',
    undefinedName: classified.undefinedName ?? null,
    title: classified.title ?? '',
    causes: parts.causes,
    fixCode: parts.fixCode,
    fixComment: parts.fixComment,
    documentationUrl: parts.documentationUrl,
    severity: classified.severity,
  };
};

interface ErrorLocationInput {
  lineno: number | null | undefined;
  colno: number | null | undefined;
  templatePath: string | undefined;
  isJsCaller: boolean;
}

const resolveErrorLocation = (error: ErrorLike | null, input: ErrorLocationInput): LocationInfo => {
  const lineBaseValue: LineBase = input.isJsCaller ? 'one' : (error?.lineBase ?? 'zero');
  const location = toDisplayLocation({
    lineno: input.lineno ?? error?.lineno ?? null,
    colno: input.colno ?? error?.colno ?? null,
    lineBase: lineBaseValue,
  });
  return {
    displayLine: location.line,
    displayCol: location.col,
    displayPath: input.templatePath ?? 'unknown',
    lineBaseValue,
  };
};

/**
 * Classifies an error and derives its human title, extracting the undefined name from
 * the plain message when the classifier did not provide one.
 */
const classifyAndBuildTitle = (error: ErrorLike) => {
  const classified = classifyError(error);
  const plain = toText(error, { verbosity: 'simple' });
  const undefinedName = classified.undefinedName ?? plain.match(UNDEFINED_OUTPUT_RE)?.[1] ?? null;
  return resolveHumanTitle({
    category: classified.category,
    undefinedName,
    plain,
    fallback: classified.title ?? plain,
  });
};

/**
 * Classifies the error and resolves its display path and 1-based coordinates in one pass
 * for the HTML renderers; JS callers get one-based coordinates via `isJsCaller`.
 */
const buildErrorDisplay = (
  error: ErrorLike,
  input: {
    templatePath: string | undefined;
    lineno: number | undefined;
    colno: number | undefined;
    isJsCaller: boolean;
  }
) => {
  const classified = classifyError(error);
  const { displayLine, displayCol, displayPath } = resolveErrorLocation(error, {
    lineno: input.lineno,
    colno: input.colno,
    templatePath: input.templatePath,
    isJsCaller: input.isJsCaller,
  });
  return { classified, displayLine, displayCol, displayPath };
};

export { buildErrorDisplay, classifyAndBuildTitle, classifyError, renderBadge, resolveHumanTitle };

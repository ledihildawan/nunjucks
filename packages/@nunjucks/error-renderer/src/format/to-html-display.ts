import type { LineBase } from '@nunjucks/error-catalog';
import { classifyFromError, type HumanTitleInput } from '@nunjucks/error-catalog';
import { mergeErrorParts } from './presentation/error/error-parts.ts';
import { toDisplayLocation } from './presentation/source-trace/location.ts';
import { escapeAttribute, escapeHtml } from './presentation/syntax-highlight/highlight.ts';
import type { ClassifiedError, ErrorLike, LocationInfo } from './to-html-types.ts';

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

/** Classifies an error via the catalog and merges attached parts into a display view. */
const classifyError = (error: ErrorLike): ClassifiedError => {
  const parts = mergeErrorParts(error);
  const classified = classifyFromError(error);
  return {
    category: error.code ?? classified.category.toUpperCase(),
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

export { buildErrorDisplay, classifyError, renderBadge };
export type { HumanTitleInput };

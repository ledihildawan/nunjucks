import { classifyFromError } from '@nunjucks/error-catalog';
import { mergeErrorParts } from './presentation/error/error-parts.ts';
import { toText } from './to-text.ts';
import { escapeHtml } from './presentation/syntax-highlight/highlight.ts';
import { toDisplayLocation } from './presentation/source-trace/location.ts';
import type { LineBase } from '@nunjucks/error-catalog';
import type { ClassifiedError, ErrorLike, HumanTitleInput, LocationInfo } from './to-html-types.ts';

const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;
const RESERVED_KEYWORD_RE = /Cannot use reserved (\w+) '([^']+)'/u;

const renderBadge = (variant: string, text?: string | null): string => {
  if (!text) { return ''; }
  return `<span class="badge ${variant}">${escapeHtml(text)}</span>`;
};

const resolveHumanTitle = ({ category, undefinedName, plain, fallback }: HumanTitleInput): string => {
  const named = undefinedName ?? 'unknown';

  switch (category) {
    case 'UNDEFINED_VARIABLE':
      if (!undefinedName) { return fallback; }
      return `Variable '${undefinedName}' is not defined`;
    case 'UNDEFINED_FUNCTION':
      return `Function '${named}' is not defined`;
    case 'UNDEFINED_FILTER':
      return `Filter '${named}' is not defined`;
    case 'IMPORT_ERROR':
      return 'Cannot import template - module not found';
    case 'FILE_NOT_FOUND':
      return `Template file not found: ${named}`;
    case 'SYNTAX_ERROR':
      return 'Template syntax error';
    case 'VALIDATION_ERROR':
      return 'Template must be a string';
    case 'DICTSDICT_FILTER_BY':
    case 'RESERVED_KEYWORD_CONTEXT':
      return plain;
    case 'RESERVED_KEYWORD': {
      const match = plain.match(RESERVED_KEYWORD_RE);
      if (!match) { return fallback; }
      return `Cannot use reserved ${match[1]} '${match[2]}'`;
    }
    default:
      return fallback;
  }
};

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
    lineBase: lineBaseValue
  });
  return {
    displayLine: location.line,
    displayCol: location.col,
    displayPath: input.templatePath ?? 'unknown',
    lineBaseValue,
  };
};

const classifyAndBuildTitle = (error: ErrorLike) => {
  const classified = classifyError(error);
  const plain = toText(error, { verbosity: 'simple' });
  const undefinedName = classified.undefinedName ?? plain.match(UNDEFINED_OUTPUT_RE)?.[1] ?? null;
  return resolveHumanTitle({
    category: classified.category,
    undefinedName,
    plain,
    fallback: classified.title ?? plain
  });
};

const buildErrorDisplay = (
  error: ErrorLike,
  input: { templatePath: string | undefined; lineno: number | undefined; colno: number | undefined; isJsCaller: boolean }
) => {
  const classified = classifyError(error);
  const { displayLine, displayCol, displayPath } = resolveErrorLocation(
    error, { lineno: input.lineno, colno: input.colno, templatePath: input.templatePath, isJsCaller: input.isJsCaller }
  );
  return { classified, displayLine, displayCol, displayPath };
};

export { classifyError, classifyAndBuildTitle, buildErrorDisplay, renderBadge, resolveHumanTitle };

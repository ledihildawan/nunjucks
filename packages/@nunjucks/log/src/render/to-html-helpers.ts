import { classifyFromError } from '../errors/classify.ts';
import { toText } from './to-text.ts';
import { escapeHtml, highlightHtml, highlightJs } from './internal/highlight.ts';
import { toDisplayLocation, type LineBase } from './internal/location.ts';
import type { ClassifiedError, ErrorLike, HumanTitleInput, LocationInfo } from './to-html-types.ts';

const SCRIPT_EXTENSION_RE = /\.(?:[cm]?[jt]sx?|mjs|cjs)$/iu;
const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;
const RESERVED_KEYWORD_RE = /Cannot use reserved (\w+) '([^']+)'/u;

const isScriptPath = (filePath?: string | null): boolean =>
  SCRIPT_EXTENSION_RE.test(filePath || '');

const SEVERITY_HEADINGS: Record<string, string> = {
  warning: 'Template Warning',
  info: 'Template Info',
  error: 'Template Rendering Error',
};

const renderBadge = (variant: string, text?: string | null): string => {
  if (!text) { return ''; }
  return `<span class="badge ${variant}">${escapeHtml(text)}</span>`;
};

const resolveHumanTitle = ({ category, undefinedName, plain, fallback }: HumanTitleInput): string => {
  const named = undefinedName || 'unknown';

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

const highlightSource = (code: string, filePath?: string | null): string => {
  if (isScriptPath(filePath)) {
    return highlightJs(code);
  }
  return highlightHtml(code);
};

const classifyError = (error: ErrorLike): ClassifiedError => {
  const errWithExtras = error as {
    code?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  const classified = classifyFromError(errWithExtras);
  const possibleCauses = classified.causes && classified.causes.length > 0
    ? [...classified.causes]
    : [...(errWithExtras.causes || [])];
  return {
    category: error.code || classified.category.toUpperCase() || 'UNKNOWN',
    undefinedName: classified.undefinedName || null,
    title: classified.title || '',
    causes: possibleCauses,
    fixCode: classified.fixCode ?? errWithExtras.fixCode ?? '',
    fixComment: classified.fixComment ?? errWithExtras.fixComment ?? '',
    documentationUrl: classified.documentationUrl ?? errWithExtras.documentationUrl ?? null,
    severity: classified.severity,
  };
};

const resolveErrorLocation = (
  error: ErrorLike | null,
  lineno: number | null | undefined,
  colno: number | null | undefined,
  templatePath: string | undefined,
  isJsCaller: boolean
): LocationInfo => {
  const lineBaseValue: LineBase = isJsCaller ? 'one' : (error?.lineBase ?? 'zero');
  const location = toDisplayLocation(
    lineno ?? error?.lineno ?? null,
    colno ?? error?.colno ?? null,
    lineBaseValue
  );
  return {
    displayLine: location.line,
    displayCol: location.col,
    displayPath: templatePath || 'unknown',
    lineBaseValue,
  };
};

const classifyAndBuildTitle = (error: ErrorLike) => {
  const classified = classifyError(error);
  const plain = toText(error, { verbosity: 'simple' });
  const undefinedName = classified.undefinedName || plain.match(UNDEFINED_OUTPUT_RE)?.[1] || null;
  return resolveHumanTitle({
    category: classified.category,
    undefinedName,
    plain,
    fallback: classified.title || plain
  });
};

const buildErrorDisplay = (
  error: ErrorLike,
  templatePath: string | undefined,
  lineno: number | undefined,
  colno: number | undefined,
  isJsCaller: boolean
) => {
  const classified = classifyError(error);
  const { displayLine, displayCol, displayPath } = resolveErrorLocation(
    error, lineno, colno, templatePath, isJsCaller
  );
  return { classified, displayLine, displayCol, displayPath };
};

export { classifyError, classifyAndBuildTitle, buildErrorDisplay, renderBadge, resolveHumanTitle, highlightSource, isScriptPath, SEVERITY_HEADINGS };

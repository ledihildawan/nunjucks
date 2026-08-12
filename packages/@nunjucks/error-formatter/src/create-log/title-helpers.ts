import { toText } from '@nunjucks/error-renderer';
import { classifyFromError } from '@nunjucks/error-catalog';
import { mergeErrorParts } from './merge-error-parts.ts';

const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;
const RESERVED_KEYWORD_RE = /Cannot use reserved (\w+) '([^']+)'/u;

interface HumanTitleInput {
  category: string;
  undefinedName: string | null;
  plain: string;
  fallback: string;
}

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

interface ClassifiedError {
  category: string;
  undefinedName: string | null;
  title: string;
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: 'error' | 'warning' | 'info';
}

const classifyError = (error: unknown): ClassifiedError => {
  const errObj = error as {
    code?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
  };
  const parts = mergeErrorParts(errObj);
  const classified = classifyFromError(errObj);
  return {
    category: errObj.code ?? classified.category.toUpperCase() ?? 'UNKNOWN',
    undefinedName: classified.undefinedName ?? null,
    title: classified.title ?? '',
    causes: parts.causes,
    fixCode: parts.fixCode,
    fixComment: parts.fixComment,
    documentationUrl: parts.documentationUrl,
    severity: classified.severity,
  };
};

const classifyAndBuildTitle = (error: unknown): string => {
  const classified = classifyError(error);
  const plain = toText(error as Parameters<typeof toText>[0], { verbosity: 'simple' });
  const undefinedName = classified.undefinedName ?? plain.match(UNDEFINED_OUTPUT_RE)?.[1] ?? null;
  return resolveHumanTitle({
    category: classified.category,
    undefinedName,
    plain,
    fallback: classified.title ?? plain
  });
};

export { resolveHumanTitle, classifyError, classifyAndBuildTitle };
export type { HumanTitleInput, ClassifiedError };

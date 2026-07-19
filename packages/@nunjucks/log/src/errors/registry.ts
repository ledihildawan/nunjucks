import { mapValues, fromEntries, values } from 'remeda';
import type { ErrorDefinition, Classification, SubjectExtractor } from './types.ts';
import { firstCapture } from './types.ts';
import { RUNTIME_ERRORS } from './runtime.ts';
import { PARSER_ERRORS } from './parser.ts';
import { SANDBOX_ERRORS } from './sandbox.ts';
import { IO_ERRORS } from './io.ts';
import { FILTER_ERRORS } from './filter.ts';
import { TEMPLATE_ERRORS } from './template.ts';
import { META_ERRORS } from './meta.ts';

export const ERROR_DEFINITIONS = {
  ...RUNTIME_ERRORS,
  ...PARSER_ERRORS,
  ...SANDBOX_ERRORS,
  ...IO_ERRORS,
  ...FILTER_ERRORS,
  ...TEMPLATE_ERRORS,
  ...META_ERRORS
} as unknown as Record<string, ErrorDefinition>;

export type ErrorName = keyof typeof ERROR_DEFINITIONS;

type ErrorMessageFn = (args?: Record<string, string> | string[]) => string;

export const ERRORS: Record<ErrorName, ErrorMessageFn> = mapValues(ERROR_DEFINITIONS, (def) => def.message) as Record<ErrorName, ErrorMessageFn>;

export const PATTERNS: Record<ErrorName, RegExp> = mapValues(ERROR_DEFINITIONS, (def) => def.pattern) as Record<ErrorName, RegExp>;

interface Rule {
  pattern: RegExp;
  category: string;
  subjectFrom: SubjectExtractor | null;
  titleTemplate?: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
  documentationUrl?: string;
  relatedLinks?: Array<{ label: string; url: string }>;
  severity?: ErrorDefinition['severity'];
  sourceFromStack?: boolean;
}

export const RULES: Rule[] = values(ERROR_DEFINITIONS).map((def) => ({
  pattern: def.pattern,
  category: def.category,
  subjectFrom: def.subjectFrom ?? firstCapture,
  titleTemplate: def.titleTemplate,
  causes: def.causes,
  fixCode: def.fixCode,
  fixComment: def.fixComment,
  suggestion: def.suggestion,
  documentationUrl: def.documentationUrl,
  relatedLinks: def.relatedLinks,
  severity: def.severity,
  sourceFromStack: def.sourceFromStack
}));

export const DEFAULT_CLASSIFICATION: Classification = {
  category: 'unknown',
  undefinedName: null,
  causes: [
    'Check template **syntax**',
    'Verify **variable scope**',
    'Check **render context** data'
  ],
  fixCode: 'Inspect the error message above for clues',
  fixComment: 'Review the template source and context',
  suggestion: null,
  documentationUrl: null,
  relatedLinks: [],
  severity: 'error'
};

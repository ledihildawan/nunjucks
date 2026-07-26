import { mapValues, values } from 'remeda';
import type { ErrorDefinition, Classification, SubjectExtractor, ExtraExtractor } from './types.ts';
import { firstCapture } from './types.ts';
import { RUNTIME_ERRORS } from './runtime.ts';
import { PARSER_ERRORS } from './parser.ts';
import { SANDBOX_ERRORS } from './sandbox.ts';
import { IO_ERRORS } from './io.ts';
import { FILTER_ERRORS } from './filter.ts';
import { TEMPLATE_ERRORS } from './template.ts';
import { META_ERRORS } from './meta.ts';

const _allErrors = {
  ...RUNTIME_ERRORS,
  ...PARSER_ERRORS,
  ...SANDBOX_ERRORS,
  ...IO_ERRORS,
  ...FILTER_ERRORS,
  ...TEMPLATE_ERRORS,
  ...META_ERRORS
};

type ErrorName = keyof typeof _allErrors;

const ERROR_DEFINITIONS = _allErrors as unknown as Record<ErrorName, ErrorDefinition>;

function getError<T extends ErrorName>(name: T): ErrorDefinition {
  return ERROR_DEFINITIONS[name];
}

type ErrorMessageFn = (args?: Record<string, string> | string[]) => string;

const ERRORS: Record<ErrorName, ErrorMessageFn> = mapValues(ERROR_DEFINITIONS, (def) => def.message) as Record<ErrorName, ErrorMessageFn>;

const PATTERNS: Record<ErrorName, RegExp> = mapValues(ERROR_DEFINITIONS, (def) => def.pattern) as Record<ErrorName, RegExp>;

interface Rule {
  pattern: RegExp;
  category: string;
  subjectFrom: SubjectExtractor | null;
  extraFrom: ExtraExtractor | null;
  titleTemplate?: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: ErrorDefinition['severity'];
  sourceFromStack?: boolean;
}

const RULES: Rule[] = values(ERROR_DEFINITIONS).map((def) => ({
  pattern: def.pattern,
  category: def.category,
  subjectFrom: def.subjectFrom ?? firstCapture,
  extraFrom: def.extraFrom ?? null,
  titleTemplate: def.titleTemplate,
  causes: def.causes,
  fixCode: def.fixCode,
  fixComment: def.fixComment,
  documentationUrl: def.documentationUrl,
  severity: def.severity,
  sourceFromStack: def.sourceFromStack
}));

const DEFAULT_CLASSIFICATION: Classification = {
  category: 'unknown',
  undefinedName: null,
  causes: [
    'Check template **syntax**',
    'Verify **variable scope**',
    'Check **render context** data'
  ],
  fixCode: 'Inspect the error message above for clues',
  fixComment: 'Review the template source and context',
  documentationUrl: null,
  severity: 'error'
};

export { ERROR_DEFINITIONS, getError, ERRORS, PATTERNS, RULES, DEFAULT_CLASSIFICATION };
export type { ErrorName };

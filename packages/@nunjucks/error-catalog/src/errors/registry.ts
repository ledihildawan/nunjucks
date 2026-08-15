import { map, pipe, values } from 'remeda';
import { FILTER_ERRORS } from './filter.ts';
import { IO_ERRORS } from './io.ts';
import { LEXER_ERRORS } from './lexer.ts';
import { PARSER_ERRORS } from './parser.ts';
import { RUNTIME_ERRORS } from './runtime/index.ts';
import { SANDBOX_ERRORS } from './sandbox.ts';
import { TEMPLATE_ERRORS } from './template.ts';
import type { Classification, ErrorDefinition, ExtraExtractor, SubjectExtractor } from './types.ts';
import { firstCapture } from './types.ts';

const allErrors = {
  ...RUNTIME_ERRORS,
  ...PARSER_ERRORS,
  ...SANDBOX_ERRORS,
  ...IO_ERRORS,
  ...FILTER_ERRORS,
  ...TEMPLATE_ERRORS,
  ...LEXER_ERRORS,
};

type ErrorName = keyof typeof allErrors;

const ERROR_DEFINITIONS: Record<ErrorName, ErrorDefinition> = allErrors;

const getError = <T extends ErrorName>(name: T): ErrorDefinition => {
  return ERROR_DEFINITIONS[name];
};

interface Rule {
  pattern: RegExp;
  category: string;
  subjectFrom: SubjectExtractor | null;
  extraFrom: ExtraExtractor | null;
  titleTemplate?: string;
  causes: readonly string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: ErrorDefinition['severity'];
}

const toRule = (def: ErrorDefinition): Rule => ({
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
});

const RULES: Rule[] = pipe(ERROR_DEFINITIONS, values(), map(toRule));

const DEFAULT_CLASSIFICATION: Classification = {
  category: 'unknown',
  undefinedName: null,
  causes: [
    'Check template **syntax**',
    'Verify **variable scope**',
    'Check **render context** data',
  ],
  fixCode: 'Inspect the error message above for clues',
  fixComment: 'Review the template source and context',
  documentationUrl: null,
  severity: 'error',
};

export { DEFAULT_CLASSIFICATION, ERROR_DEFINITIONS, getError, RULES, toRule };

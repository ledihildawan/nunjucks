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

/**
 * Defines the master error registry: the merged mapping of every catalogued
 * error code (across runtime, parser, sandbox, I/O, filter, template, and lexer
 * groups) to its `ErrorDefinition`. Key order follows group merge order and is
 * the single source of truth for code-name stability.
 */
const ERROR_DEFINITIONS: Record<ErrorName, ErrorDefinition> = allErrors;

/** Resolves the definition registered under an exact error code name. */
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

/**
 * Flattens a definition into a runtime classification rule, defaulting
 * `subjectFrom` to `firstCapture` when absent while honoring an explicit `null`.
 */
const toRule = (def: ErrorDefinition): Rule => ({
  pattern: def.pattern,
  category: def.category,
  // WHY: `!== undefined` distinguishes an explicit `subjectFrom: null` (definitively
  // no subject — never extract from captures) from an absent field (fall back to the
  // first capture group). `??` conflated the two and mis-extracted for explicit-null defs.
  subjectFrom: def.subjectFrom !== undefined ? def.subjectFrom : firstCapture,
  extraFrom: def.extraFrom ?? null,
  titleTemplate: def.titleTemplate,
  causes: def.causes,
  fixCode: def.fixCode,
  fixComment: def.fixComment,
  documentationUrl: def.documentationUrl,
  severity: def.severity,
});

/** Precompiles every registry definition into a classification rule, in registry order. */
const RULES: Rule[] = pipe(ERROR_DEFINITIONS, values(), map(toRule));

/**
 * Defines the fallback classification returned when no classifier claims an
 * input — generic guidance under category `'unknown'` and severity `'error'`.
 */
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

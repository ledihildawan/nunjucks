export { classifyFromError } from './classify.ts';
export { createErrorDefinition } from './factory.ts';
export { FILTER_ERRORS } from './filter.ts';
export { IO_ERRORS } from './io.ts';
export { LEXER_ERRORS } from './lexer.ts';
export { PARSER_ERRORS } from './parser.ts';
export { ERROR_DEFINITIONS, getError } from './registry.ts';
export { RUNTIME_ERRORS } from './runtime/index.ts';
export { SANDBOX_ERRORS } from './sandbox.ts';
export { TEMPLATE_ERRORS } from './template.ts';
export type {
  Classification,
  Classifier,
  ClassifyInput,
  ErrorDefinition,
  ErrorSeverity,
  ExtraExtractor,
  SubjectExtractor,
} from './types.ts';
export { firstCapture } from './types.ts';

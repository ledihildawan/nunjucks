export {
	DEFINITIONS,
	ERROR_DEFINITIONS,
	ERRORS,
	PATTERNS,
	type ErrorCode,
	type ErrorMessageFn
} from './DEFINITIONS.ts';

export {
	type ClassifiedError,
	type ClassifyInput,
	type Classification,
	type ClassificationRule,
	type ErrorContext,
	type ErrorDefinitionEntry,
	type ErrorInfo,
	type OutputOptions,
	type SubjectExtractor,
	type TemplateError,
	type TemplateWarning,
	type WarningContext,
	type WarningInfo,
	DEFAULT_CLASSIFICATION
} from './types.ts';

export { createErrorLog } from './create-log.ts';

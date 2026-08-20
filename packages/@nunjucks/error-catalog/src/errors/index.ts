export { classifyFromError } from './classify.ts';
export { classifyAndBuildTitle } from './classify-title.ts';
// WHY: per-file ERROR groups stay module-private — registry.ts composes them directly;
// external consumers only need ERROR_DEFINITIONS/getError.
export { ERROR_DEFINITIONS, getError } from './registry.ts';
export type {
  Classification,
  Classifier,
  ClassifyInput,
  ErrorDefinition,
  ErrorSeverity,
  ExtraExtractor,
  HumanTitleInput,
  SubjectExtractor,
} from './types.ts';

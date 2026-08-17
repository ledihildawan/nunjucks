/** Derives the classification subject from a definition pattern's capture groups. */
type SubjectExtractor = (groups: RegExpMatchArray) => string | null;
/** Derives additional placeholder values from a definition pattern's capture groups. */
type ExtraExtractor = (groups: RegExpMatchArray) => Record<string, string> | null;

// WHY: canonical severity union — every other package imports ErrorSeverity from the
// catalog barrel instead of re-declaring the inline union.
type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Defines one catalogued error: its stable code `name`, a `message` template
 * whose `{placeholder}` params double as pattern captures, the `pattern` used to
 * re-recognize raw throws, plus causes and fix hints surfaced to consumers.
 */
interface ErrorDefinition {
  readonly name: string;
  readonly message: string | ((args?: Record<string, string> | string[]) => string);
  readonly pattern: RegExp;
  readonly category: string;
  readonly titleTemplate?: string;
  readonly causes: readonly string[];
  readonly fixCode?: string;
  readonly fixComment?: string;
  readonly documentationUrl?: string;
  readonly severity?: ErrorSeverity;
  readonly subjectFrom?: SubjectExtractor | null;
  readonly extraFrom?: ExtraExtractor | null;
}

/**
 * Defines the fully-resolved diagnostic a classifier produces — every message
 * placeholder is already interpolated and every field carries a concrete value,
 * never `undefined`.
 */
interface Classification {
  readonly category: string;
  readonly undefinedName: string | null;
  readonly causes: readonly string[];
  readonly fixCode: string | null;
  readonly fixComment: string | null;
  readonly documentationUrl: string | null;
  readonly severity: ErrorSeverity;
  readonly title?: string | null;
}

/** Defines the raw error facets a classifier consumes; all fields are optional. */
interface ClassifyInput {
  message?: string;
  code?: string | null;
  subject?: string | null;
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
}

/** Attempts to classify an input, returning `null` to defer to the next classifier. */
type Classifier = (input: ClassifyInput) => Classification | null;

/** Extracts the first regex capture group as the classification subject. */
const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export type {
  Classification,
  Classifier,
  ClassifyInput,
  ErrorDefinition,
  ErrorSeverity,
  ExtraExtractor,
  SubjectExtractor,
};
export { firstCapture };

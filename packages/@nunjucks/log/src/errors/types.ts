type SubjectExtractor = (groups: RegExpMatchArray) => string | null;
type ExtraExtractor = (groups: RegExpMatchArray) => Record<string, string> | null;

type ErrorSeverity = 'error' | 'warning' | 'info';

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
  readonly severity?: 'error' | 'warning' | 'info';
  readonly subjectFrom?: SubjectExtractor | null;
  readonly extraFrom?: ExtraExtractor | null;
}

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

interface ClassifyInput {
  message?: string;
  code?: string | null;
  subject?: string | null;
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
}

type Classifier = (input: ClassifyInput) => Classification | null;

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export { firstCapture };

export type { SubjectExtractor, ExtraExtractor, ErrorSeverity, ErrorDefinition, Classification, ClassifyInput, Classifier };

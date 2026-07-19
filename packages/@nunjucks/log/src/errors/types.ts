type CaptureGroup = string;

export type SubjectExtractor = (groups: RegExpMatchArray) => string | null;
export type ExtraExtractor = (groups: RegExpMatchArray) => Record<string, string> | null;

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorDefinition {
  name: string;
  message: string | ((args?: Record<string, string> | CaptureGroup[]) => string);
  pattern: RegExp;
  category: string;
  titleTemplate?: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
  documentationUrl?: string;
  relatedLinks?: Array<{ label: string; url: string }>;
  severity?: ErrorSeverity;
  subjectFrom?: SubjectExtractor | null;
  extraFrom?: ExtraExtractor | null;
  sourceFromStack?: boolean;
}

export interface Classification {
  category: string;
  undefinedName: string | null;
  causes: string[];
  fixCode: string | null;
  fixComment: string | null;
  suggestion: string | null;
  documentationUrl: string | null;
  relatedLinks: Array<{ label: string; url: string }>;
  severity: ErrorSeverity;
  title?: string | null;
}

export interface ClassifyInput {
  message?: string;
  code?: string;
  subject?: string;
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
}

export type Classifier = (input: ClassifyInput) => Classification | null;

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export { firstCapture };


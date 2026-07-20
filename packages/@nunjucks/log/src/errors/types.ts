type CaptureGroup = string;

export type SubjectExtractor = (groups: RegExpMatchArray) => string | null;
export type ExtraExtractor = (groups: RegExpMatchArray) => Record<string, string> | null;

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorDefinition {
  name: string;
  message: string | ((args?) => string);
  pattern: RegExp;
  category: string;
  titleTemplate?: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
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
  documentationUrl: string | null;
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
}

export type Classifier = (input: ClassifyInput) => Classification | null;

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export { firstCapture };


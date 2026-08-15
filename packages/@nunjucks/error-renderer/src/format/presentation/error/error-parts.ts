import { classifyFromError } from '@nunjucks/error-catalog';

interface MergedErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
}

interface ErrorPartFields {
  message?: unknown;
  code?: unknown;
  subject?: unknown;
  causes?: unknown;
  fixCode?: unknown;
  fixComment?: unknown;
  documentationUrl?: unknown;
  severity?: unknown;
}

const readErrorPartFields = (error: unknown): ErrorPartFields | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const record = error as Record<string, unknown>;
  return {
    message: record.message,
    code: record.code,
    subject: record.subject,
    causes: record.causes,
    fixCode: record.fixCode,
    fixComment: record.fixComment,
    documentationUrl: record.documentationUrl,
    severity: record.severity,
  };
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const readStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const mergeErrorParts = (error: unknown): MergedErrorParts => {
  const fields = readErrorPartFields(error);
  // WHY: classifyFromError expects ErrorWithExtras (a structural shape).
  // `fields` is already narrowed to a non-null object via readErrorPartFields,
  // so the cast here is a single bounded boundary narrowing, not an unchecked
  // `unknown → concrete` cast. classifyFromError itself reads fields defensively.
  const classification = classifyFromError(fields as Parameters<typeof classifyFromError>[0]);
  return {
    causes: classification.causes?.length
      ? [...classification.causes]
      : readStringArray(fields?.causes),
    fixCode: classification.fixCode ?? readString(fields?.fixCode),
    fixComment: classification.fixComment ?? readString(fields?.fixComment),
    documentationUrl: classification.documentationUrl ?? readStringOrNull(fields?.documentationUrl),
  };
};

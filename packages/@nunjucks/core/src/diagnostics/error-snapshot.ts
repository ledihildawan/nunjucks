import type { normalizeErrorMetadata } from '@nunjucks/error-formatter';
import { isKeyedObject, MATCH_ANY_RE } from '@nunjucks/lib';

const readStringProp = (value: unknown, key: string): string | undefined => {
  if (!isKeyedObject(value)) {
    return undefined;
  }
  const stringValue = value[key];
  return typeof stringValue === 'string' ? stringValue : undefined;
};

const extractErrorSnapshot = (err: unknown): Record<string, unknown> => {
  if (!isKeyedObject(err)) {
    return {};
  }
  const { lineBase, lineno, colno, ...rest } = err;
  const name = readStringProp(err, 'name');
  const message = readStringProp(err, 'message');
  return {
    ...rest,
    ...(name !== undefined && { name }),
    ...(message !== undefined && { message }),
  };
};

const resolveErrorProps = (
  err: unknown
): {
  resolvedCauses: string[] | undefined;
  resolvedFixCode: string | undefined;
  resolvedFixComment: string | undefined;
  resolvedSuggestion: string | undefined;
  resolvedDocumentationUrl: string | undefined;
  originalSeverity: 'error' | 'warning' | 'info' | undefined;
} => {
  const record = isKeyedObject(err) ? err : null;
  const causes = record?.causes;
  const fixCode = record?.fixCode;
  const fixComment = record?.fixComment;
  const suggestion = record?.suggestion;
  const documentationUrl = record?.documentationUrl;
  const severity = record?.severity;
  return {
    resolvedCauses: Array.isArray(causes) && causes.length > 0 ? causes : undefined,
    resolvedFixCode: typeof fixCode === 'string' ? fixCode : undefined,
    resolvedFixComment: typeof fixComment === 'string' ? fixComment : undefined,
    resolvedSuggestion: typeof suggestion === 'string' ? suggestion : undefined,
    resolvedDocumentationUrl: typeof documentationUrl === 'string' ? documentationUrl : undefined,
    originalSeverity:
      severity === 'error' || severity === 'warning' || severity === 'info' ? severity : undefined,
  };
};

const buildErrorDef = (
  metadata: ReturnType<typeof normalizeErrorMetadata>,
  resolved: ReturnType<typeof resolveErrorProps>
) => ({
  name: metadata.code ?? 'RENDER_ERROR',
  message: () => metadata.message,
  pattern: MATCH_ANY_RE,
  causes: resolved.resolvedCauses,
  fixCode: resolved.resolvedFixCode,
  fixComment: resolved.resolvedFixComment,
  suggestion: resolved.resolvedSuggestion,
  documentationUrl: resolved.resolvedDocumentationUrl,
  severity: resolved.originalSeverity ?? 'error',
});

const toRenderContext = (value: unknown): Record<string, unknown> | null =>
  isKeyedObject(value) ? (value as Record<string, unknown>) : null;

export { buildErrorDef, extractErrorSnapshot, resolveErrorProps, toRenderContext };

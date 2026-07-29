import type { LineBase } from './location.ts';
import { normalizeLineBase } from './location.ts';

interface ErrorMetadataFallback {
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
  phase?: string | null;
  templateName?: string | null;
  templatePath?: string | null;
  sourceContent?: string | null;
  sourceStartLine?: number | null;
  renderContext?: Record<string, unknown> | null;
  code?: string | null;
  subject?: string | null;
}

interface NormalizedErrorMetadata {
  error: Error;
  message: string;
  lineno: number | null;
  colno: number | null;
  lineBase: LineBase;
  phase: string | null;
  templateName: string | null;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: Record<string, unknown> | null;
  code: string | null;
  subject: string | null;
}

const readObject = (value: unknown): Record<string, unknown> => {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    return value as Record<string, unknown>;
  }
  return {};
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const readNumber = (value: unknown): number | null => {
  if (Number.isInteger(value)) {
    return value as number;
  }
  return null;
};

const readContext = (value: unknown): Record<string, unknown> | null => {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

const readLineBase = (value: unknown): LineBase | null => {
  if (value === 'zero' || value === 'one') {
    return value;
  }
  return null;
};

const stringifyThrown = (thrown: unknown): string => {
  if (typeof thrown === 'string') { return thrown; }
  if (thrown === null || thrown === undefined) { return String(thrown); }
  const object = readObject(thrown);
  const message = readString(object.message);
  if (message !== null) { return message; }
  try {
    const serialized = JSON.stringify(thrown);
    return serialized ?? String(thrown);
  } catch {
    return String(thrown);
  }
};

const getError = (thrown: unknown, message: string): Error =>
  thrown instanceof Error ? thrown : new Error(message);

const normalizeFallbacks = (source: Record<string, unknown>, fallback: ErrorMetadataFallback, templateName: string | null) => ({
  lineno: readNumber(source.lineno) ?? fallback.lineno ?? null,
  colno: readNumber(source.colno) ?? fallback.colno ?? null,
  lineBase: normalizeLineBase(readLineBase(source.lineBase) ?? fallback.lineBase),
  phase: readString(source.phase) ?? fallback.phase ?? null,
  templateName,
  templatePath: readString(source.templatePath) ?? fallback.templatePath ?? templateName,
  sourceContent: readString(source.sourceContent) ?? fallback.sourceContent ?? null,
  sourceStartLine: readNumber(source.sourceStartLine) ?? fallback.sourceStartLine ?? 1,
  renderContext: readContext(source.renderContext) ?? fallback.renderContext ?? null,
  code: readString(source.code) ?? fallback.code ?? null,
  subject: readString(source.subject) ?? fallback.subject ?? null,
});

const normalizeErrorMetadata = (
  thrown: unknown,
  fallback: ErrorMetadataFallback = {}
): NormalizedErrorMetadata => {
  const source = readObject(thrown);
  const message = stringifyThrown(thrown);
  const error = getError(thrown, message);
  const templateName = readString(source.templateName) ?? fallback.templateName ?? null;

  return {
    error,
    message,
    ...normalizeFallbacks(source, fallback, templateName),
  };
};

export { normalizeErrorMetadata, readNumber };
export type { ErrorMetadataFallback, NormalizedErrorMetadata };

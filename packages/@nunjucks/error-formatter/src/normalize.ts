import { normalizeLineBase, type LineBase } from '@nunjucks/error-catalog';
import type { Phase } from '@nunjucks/shared';
import { readObject, readString, readNumber, isKeyedObject } from '@nunjucks/lib';

interface ErrorMetadataFallback {
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
  phase?: Phase | null;
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
  phase: Phase | null;
  templateName: string | null;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: Record<string, unknown> | null;
  code: string | null;
  subject: string | null;
}

const readContext = (value: unknown): Record<string, unknown> | null =>
  isKeyedObject(value) ? value : null;

const readLineBase = (value: unknown): LineBase | null => {
  if (value === 'zero' || value === 'one') {
    return value;
  }
  return null;
};

const readPhase = (value: unknown): Phase | null => {
  if (value === 'compile' || value === 'render' || value === 'load' || value === 'parse') {
    return value;
  }
  return null;
};

// WHY: hostile-object guards — a throwing getter or toString on the thrown value must
// never crash the normalizer itself (error handling runs at the worst possible moment).
// Descriptor-based access is the technique proven in error-renderer's safe-context.ts.
const readOwnStringSafe = (source: Record<string, unknown>, key: string): string | null => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor && 'value' in descriptor) {
      return readString(descriptor.value);
    }
    return null;
  } catch {
    return null;
  }
};

const stringifySafe = (thrown: unknown): string => {
  try {
    return String(thrown);
  } catch {
    return '[unstringifiable error]';
  }
};

const stringifyThrown = (thrown: unknown): string => {
  if (typeof thrown === 'string') { return thrown; }
  if (thrown === null || thrown === undefined) { return String(thrown); }
  const object = readObject(thrown);
  if (object !== null) {
    const message = readOwnStringSafe(object, 'message');
    if (message !== null) { return message; }
  }
  try {
    const serialized = JSON.stringify(thrown);
    return serialized ?? stringifySafe(thrown);
  } catch {
    return stringifySafe(thrown);
  }
};

const getError = (thrown: unknown, message: string): Error =>
  thrown instanceof Error ? thrown : new Error(message);

interface NormalizeFallbacksOptions {
  source: Record<string, unknown>;
  fallback: ErrorMetadataFallback;
  templateName: string | null;
}

const normalizeFallbacks = ({ source, fallback, templateName }: NormalizeFallbacksOptions) => ({
  lineno: readNumber(source.lineno) ?? fallback.lineno ?? null,
  colno: readNumber(source.colno) ?? fallback.colno ?? null,
  lineBase: normalizeLineBase(readLineBase(source.lineBase) ?? fallback.lineBase),
  phase: readPhase(source.phase) ?? fallback.phase ?? null,
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
    ...normalizeFallbacks({ source, fallback, templateName }),
  };
};

export { normalizeErrorMetadata };
export type { ErrorMetadataFallback, NormalizedErrorMetadata };

import type { LineBase } from './location.ts';
import { normalizeLineBase } from './location.ts';

export interface ErrorMetadataFallback {
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

export interface NormalizedErrorMetadata {
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

const readObject = (value: unknown): Record<string, unknown> =>
  value !== null && (typeof value === 'object' || typeof value === 'function')
    ? value as Record<string, unknown>
    : {};

const readString = (value: unknown): string | null => typeof value === 'string' ? value : null;
const readNumber = (value: unknown): number | null => Number.isInteger(value) ? value as number : null;
const readContext = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;

const readLineBase = (value: unknown): LineBase | null =>
  value === 'zero' || value === 'one' ? value : null;

const stringifyThrown = (thrown: unknown): string => {
  if (typeof thrown === 'string') return thrown;
  if (thrown === null || thrown === undefined) return String(thrown);
  const object = readObject(thrown);
  const message = readString(object.message);
  if (message !== null) return message;
  try {
    const serialized = JSON.stringify(thrown);
    return serialized ?? String(thrown);
  } catch {
    return String(thrown);
  }
};

export const normalizeErrorMetadata = (
  thrown: unknown,
  fallback: ErrorMetadataFallback = {}
): NormalizedErrorMetadata => {
  const source = readObject(thrown);
  const message = stringifyThrown(thrown);
  const error = thrown instanceof Error ? thrown : new Error(message);
  const templateName = readString(source.templateName) ?? fallback.templateName ?? null;

  return {
    error,
    message,
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
  };
};

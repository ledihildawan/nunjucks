import type { Phase, UndefinedMode } from '@nunjucks/shared';
import type { ErrorSeverity } from './errors/types.ts';
import type { LineBase } from './line-base.ts';

/**
 * Defines the structural shape every error-like value is normalized against —
 * all fields are optional so raw engine throws, wrapped envelopes, and
 * diagnostics snapshots flow through one type.
 */
export interface ErrorLike {
  message?: string;
  stack?: string;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
  templatePath?: string | null;
  sourceContent?: string;
  renderContext?: Record<string, unknown>;
  phase?: Phase | null;
  code?: string | null;
  lineBase?: LineBase | null;
  blockedKeys?: readonly string[];
  severity?: ErrorSeverity;
  timestamp?: string | null;
  environment?: string | null;
}

/** Narrows any non-null object to the structural `ErrorLike` shape. */
export const isRecord = (value: unknown): value is ErrorLike =>
  typeof value === 'object' && value !== null;

/**
 * Defines a non-fatal diagnostic emitted during rendering — mirrors the error
 * envelope's optional location and context fields without requiring any of them.
 */
export interface Warning {
  message: string;
  code?: string | null;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
  undefinedMode?: UndefinedMode;
  varName?: string | null;
  subject?: string | null;
  lineBase?: LineBase | null;
}

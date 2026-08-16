import type { Phase, UndefinedMode } from '@nunjucks/shared';
import type { ErrorSeverity } from './errors/types.ts';
import type { LineBase } from './line-base.ts';

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

export const isObjectValue = (value: unknown): value is ErrorLike =>
  typeof value === 'object' && value !== null;

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

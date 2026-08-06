import type { LineBase } from './line-base.ts';

/**
 * Minimal structural shape that all error-presenters (HTML/ANSI/text/console)
 * can assume about an error-like input. Centralised here so presenters stop
 * casting inline (`error as { templateName?: string; lineno?: number; ... }`).
 *
 * For richer metadata, see `TemplateError` in `./create-log-types.ts`.
 */
export interface ErrorLike {
  message?: string;
  stack?: string;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
  templatePath?: string | null;
  sourceContent?: string;
  phase?: string | null;
  code?: string | null;
  lineBase?: LineBase | null;
  blockedKeys?: readonly string[];
  severity?: 'error' | 'warning' | 'info';
}

export const isErrorLike = (val: unknown): val is ErrorLike =>
  typeof val === 'object' && val !== null;

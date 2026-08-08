import type { LineBase } from './line-base.ts';

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

export const isErrorLike = (value: unknown): value is ErrorLike =>
  typeof value === 'object' && value !== null;

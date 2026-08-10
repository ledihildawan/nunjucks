import type { Phase } from '@nunjucks/shared';
import { TEMPLATE_ERROR, isTemplateError } from '../branding.ts';

export interface SecurityError extends Error {
  name: 'SecurityError';
  code: string;
  dangerousPaths?: string[];
  lineno: number | null;
  colno: number | null;
  subject: string | null;
  phase: Phase | null;
  templateName: string | null;
  templatePath: string | null;
  [TEMPLATE_ERROR]?: boolean;
}

export const createSecurityError = (message: string, code = 'SECURITY_VIOLATION'): SecurityError =>
  Object.assign(new Error(message) as SecurityError, {
    name: 'SecurityError' as const,
    code,
    lineno: null,
    colno: null,
    subject: null,
    phase: 'render' as Phase,
    templateName: null,
    templatePath: null,
    [TEMPLATE_ERROR]: true,
  });

export const isSecurityError = (e: unknown): e is SecurityError =>
  e instanceof Error && e.name === 'SecurityError';

export { isTemplateError };
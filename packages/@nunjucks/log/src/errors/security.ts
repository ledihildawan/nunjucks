import { TEMPLATE_ERROR } from '../create-log/create-log-types.ts';
import { isTemplateError } from '../create-log/create-log.ts';

export interface SecurityError extends Error {
  name: 'SecurityError';
  code: string;
  dangerousPaths?: string[];
  lineno: number | null;
  colno: number | null;
  subject: string | null;
  phase: string | null;
  templateName: string | null;
  templatePath: string | null;
  [TEMPLATE_ERROR]?: boolean;
}

export const createSecurityError = (message: string, code = 'SECURITY_VIOLATION'): SecurityError => {
  const err = new Error(message) as SecurityError;
  err.name = 'SecurityError';
  err.code = code;
  err.lineno = null;
  err.colno = null;
  err.subject = null;
  err.phase = 'render';
  err.templateName = null;
  err.templatePath = null;
  err[TEMPLATE_ERROR] = true;
  return err;
};

export const isSecurityError = (e: unknown): e is SecurityError =>
  e instanceof Error && (e as Error).name === 'SecurityError';

export { isTemplateError };
import type { Phase } from '@nunjucks/shared';
import { TEMPLATE_ERROR } from '../branding.ts';

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

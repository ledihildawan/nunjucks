import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result } from '@nunjucks/lib';
import type { SafeString } from '@nunjucks/runtime';
import type { DomPurifyConfig } from '@nunjucks/shared';
import DomPurify from 'isomorphic-dompurify';
import { createFilter, safeString } from '../factory/index.ts';

interface SanitizeOptions {
  str: unknown;
  config?: DomPurifyConfig;
}

// WHY: createFilter-wrapped so BOTH forms bind — positional `sanitize(x, cfg)` and
// kwargs `sanitize(config={...})`. A bare positional function would receive the
// compiler's keywords envelope as `config`, and DOMPurify would silently fall back to
// its defaults — a fail-open against a host that restricted them.
const sanitizeImpl = ({ str, config }: SanitizeOptions): Result<SafeString, TemplateError> => {
  const clean = DomPurify.sanitize(String(str), config ?? {});
  return ok(safeString(clean));
};

export const sanitize = createFilter(['str', 'config'], sanitizeImpl);

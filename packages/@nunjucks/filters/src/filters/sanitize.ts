import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result } from '@nunjucks/lib';
import type { SafeString } from '@nunjucks/runtime';
import type { DomPurifyConfig } from '@nunjucks/shared';
import DomPurify from 'isomorphic-dompurify';
import { safeString } from '../factory/index.ts';

const sanitize = (str: unknown, config?: DomPurifyConfig): Result<SafeString, TemplateError> => {
  const input = String(str);
  const clean = DomPurify.sanitize(input, config ?? {});
  return ok(safeString(clean));
};

export { sanitize };

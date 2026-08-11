import DomPurify from 'isomorphic-dompurify';
import { safeString } from '../factory/index.ts';
import type { SafeString } from '@nunjucks/runtime';
import type { DomPurifyConfig } from '@nunjucks/shared';

const sanitize = (str: unknown, config?: DomPurifyConfig): SafeString => {
  const input = String(str);
  const clean = DomPurify.sanitize(input, config ?? {});
  return safeString(clean);
};

export { sanitize };
export type { DomPurifyConfig } from '@nunjucks/shared';

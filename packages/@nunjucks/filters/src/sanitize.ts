import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result, type SafeString } from '@nunjucks/lib';
import type { DomPurifyConfig } from '@nunjucks/shared';
import DomPurify from 'isomorphic-dompurify';
import { createFilter, safeString } from './factory/index.ts';

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

/**
 * Sanitizes markup through DOMPurify and marks the result `safe`; positional
 * `sanitize(x, cfg)` and kwargs `sanitize(config={...})` both bind.
 *
 * Opt-in security shell: this filter lives on the `@nunjucks/filters/sanitize`
 * subpath (NOT the main barrel) so the jsdom-backed DOMPurify dependency stays
 * out of the pure filter tier. Register it explicitly:
 *
 * ```ts
 * import { sanitize } from '@nunjucks/filters/sanitize';
 * nunjucks({ filters: { sanitize } });
 * ```
 *
 * WHY optional peer: `isomorphic-dompurify` is declared as BOTH a peer and an
 * optional dependency (the standard optional-peer pattern) — hosts that never
 * import this subpath are not forced to install jsdom, while workspaces that
 * register the filter get the dependency satisfied automatically. Importing
 * the subpath without the dependency installed fails at resolution time, not
 * as a silent no-sanitize at render time.
 */
export const sanitize = createFilter(['str', 'config'], sanitizeImpl);

import type { Warning } from '@nunjucks/error-catalog';
import { basename } from '@nunjucks/lib';
import { DEFAULT_UNDEFINED_MODE } from '@nunjucks/shared';

/** Options controlling the injected browser warnings script. */
interface WarningScriptOptions {
  dev?: boolean;
  verbosity?: 'simple' | 'medium' | 'full';
}

const safeJsonForScript = (value: string): string =>
  value.replaceAll('&', '\\u0026').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');

const getLocationString = (warning: Warning): string => {
  if (warning.lineno === undefined || warning.lineno === null) {
    return '';
  }
  // WHY: engine warnings are zero-based; a future one-based producer would otherwise
  // display a line one short of the truth.
  const lineBase = warning.lineBase ?? 'zero';
  const oneBased = lineBase === 'one';
  const lineNum = oneBased ? warning.lineno : warning.lineno + 1;
  // WHY: columns follow the same base adjustment as toDisplayLocation — zero-based
  // colno is off by one for display; one-based values pass through unchanged.
  const colNum = warning.colno != null ? `:${oneBased ? warning.colno : warning.colno + 1}` : '';
  const fileName = basename(warning.templateName);
  return ` at ${fileName}:${lineNum}${colNum}`;
};

const formatWarning = (
  warning: Warning | string,
  options: { verbosity?: 'simple' | 'medium' | 'full' } = {}
): string => {
  const { verbosity = 'full' } = options;
  const message = typeof warning === 'string' ? warning : warning.message;

  if (typeof warning === 'string') {
    return `[WARNING] ${message}`;
  }

  const undefinedMode = warning.undefinedMode ?? DEFAULT_UNDEFINED_MODE;
  const code = warning.code ?? null;
  const locationStr = getLocationString(warning);

  if (verbosity === 'simple') {
    return `[WARNING] ${message}`;
  }
  if (verbosity === 'medium') {
    return `[WARNING] ${message} (${undefinedMode})${locationStr}`;
  }
  const codePart = code ? ` [${code}]` : '';
  return `[WARNING] ${message} (${undefinedMode})${locationStr}${codePart}`;
};

/**
 * Builds a `<script>` tag that replays engine warnings through `console.warn`, with the
 * payload JSON-escaped so it cannot break out of the script context; returns `''` when
 * there are no warnings.
 */
const injectWarningsScript = (
  warnings: Warning[] | null | undefined,
  options: WarningScriptOptions = {}
): string => {
  const { verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) {
    return '';
  }

  const consoleScripts = warnings.map((warning) => {
    const formatted = formatWarning(warning, { verbosity });
    return `console.warn('[Nunjucks]', ${safeJsonForScript(JSON.stringify(formatted))});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};

export type { WarningScriptOptions };
export { injectWarningsScript };

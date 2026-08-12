import type { Warning } from '@nunjucks/error-catalog';
import { basename } from '@nunjucks/lib/path-basename';

interface WarningScriptOptions {
  dev?: boolean;
  verbosity?: 'simple' | 'medium' | 'full';
}

const getLocationString = (w: Warning): string => {
  if (w.lineno === undefined || w.lineno === null) {
    return '';
  }
  const lineNum = w.lineno + 1;
  const colNum = w.colno != null ? `:${w.colno}` : '';
  const fileName = basename(w.templateName);
  return ` at ${fileName}:${lineNum}${colNum}`;
};

const formatWarning = (w: Warning | string, options: { verbosity?: 'simple' | 'medium' | 'full' } = {}): string => {
  const { verbosity = 'full' } = options;
  const message = typeof w === 'string' ? w : w.message;

  if (typeof w === 'string') {
    return `[WARNING] ${message}`;
  }

  const undefinedMode = w.undefinedMode ?? 'chainable';
  const code = w.code ?? null;
  const locationStr = getLocationString(w);

  if (verbosity === 'simple') {
    return `[WARNING] ${message}`;
  }
  if (verbosity === 'medium') {
    return `[WARNING] ${message} (${undefinedMode})${locationStr}`;
  }
  const codePart = code ? ` [${code}]` : '';
  return `[WARNING] ${message} (${undefinedMode})${locationStr}${codePart}`;
};

const injectWarningsScript = (warnings: Warning[] | null | undefined, options: WarningScriptOptions = {}): string => {
  const { verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) { return ''; }

  const consoleScripts = warnings.map(w => {
    const formatted = formatWarning(w, { verbosity });
    return `console.warn('[Nunjucks]', ${JSON.stringify(formatted)});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};

export { injectWarningsScript };
export type { WarningScriptOptions };

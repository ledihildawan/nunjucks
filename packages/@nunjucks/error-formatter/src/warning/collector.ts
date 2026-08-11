import { pipe, split } from 'remeda';
import { replace } from '@nunjucks/lib';

import type { Warning } from '@nunjucks/error-catalog';

interface InjectWarningsOptions {
  dev?: boolean;
  verbosity?: 'simple' | 'medium' | 'full';
}

const getFileName = (path: string | null | undefined): string => {
  if (!path) { return 'unknown'; }
  const parts = pipe(path, replace(/\\/gu, '/'), split('/'));
  return parts.at(-1) ?? 'unknown';
};

const getLocationString = (w: Warning): string => {
  if (w.lineno === undefined || w.lineno === null) {
    return '';
  }
  const lineNum = w.lineno + 1;
  const colNum = w.colno != null ? `:${w.colno}` : '';
  const fileName = getFileName(w.templateName);
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

const injectWarningsScript = (warnings: Warning[] | null | undefined, options: InjectWarningsOptions = {}): string => {
  const { verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) { return ''; }

  const consoleScripts = warnings.map(w => {
    const formatted = formatWarning(w, { verbosity });
    return `console.warn('[Nunjucks]', ${JSON.stringify(formatted)});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};

export { injectWarningsScript };
export type { InjectWarningsOptions };

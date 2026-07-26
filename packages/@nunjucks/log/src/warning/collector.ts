/** A collected render-time warning. Exported: it is the element type of
 * `injectWarningsScript`'s first parameter. */
export interface Warning {
  message: string;
  undefinedMode?: string;
  code?: string | null;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
}

export interface InjectWarningsOptions {
  dev?: boolean;
  verbosity?: 'simple' | 'medium' | 'full';
}

const getFileName = (path: string | null | undefined): string => {
  if (!path) { return 'unknown'; }
  const parts = path.replace(/\\/gu, '/').split('/');
  return parts.at(-1) || 'unknown';
};

const formatWarning = (w: Warning | string, options: { verbosity?: 'simple' | 'medium' | 'full' } = {}): string => {
  const { verbosity = 'full' } = options;
  let message: string;
  if (typeof w === 'string') {
    message = w;
  } else {
    message = w.message;
  }

  if (typeof w === 'string') {
    if (verbosity === 'simple') {
      return `[WARNING] ${message}`;
    }
    return `[WARNING] ${message}`;
  }

  const undefinedMode = w.undefinedMode || 'chainable';
  const code = w.code || null;

  let locationStr = '';
  if (w.lineno !== undefined && w.lineno !== null) {
    const lineNum = w.lineno + 1;
    let colNum: string;
    if (w.colno !== undefined && w.colno !== null) {
      colNum = `:${w.colno}`;
    } else {
      colNum = '';
    }
    const fileName = getFileName(w.templateName);
    locationStr = ` at ${fileName}:${lineNum}${colNum}`;
  }

  let formatted: string;
  if (verbosity === 'simple') {
    formatted = `[WARNING] ${message}`;
  } else if (verbosity === 'medium') {
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}`;
  } else {
    let codePart = '';
    if (code) {
      codePart = ` [${code}]`;
    }
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}${codePart}`;
  }

  return formatted;
};

// `warnings` is nullable in the signature because this is a package entry
// point reached from untyped callers; the guard below is real, not decorative.
export const injectWarningsScript = (warnings: Warning[] | null | undefined, options: InjectWarningsOptions = {}): string => {
  const { verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) { return ''; }

  const consoleScripts = warnings.map(w => {
    const formatted = formatWarning(w, { verbosity });
    return `console.warn('[Nunjucks]', ${JSON.stringify(formatted)});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};

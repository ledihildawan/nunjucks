interface Warning {
  message: string;
  undefinedMode?: string;
  code?: string | null;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
}

interface InjectWarningsOptions {
  dev?: boolean;
  verbosity?: 'simple' | 'medium' | 'full';
}

const getFileName = (path: string | null | undefined): string => {
  if (!path) return 'unknown';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'unknown';
};

const formatWarning = (w: Warning | string, options: { verbosity?: 'simple' | 'medium' | 'full' } = {}): string => {
  const { verbosity = 'full' } = options;
  const message = typeof w === 'string' ? w : w.message;

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
    const colNum = w.colno !== undefined && w.colno !== null ? `:${w.colno}` : '';
    const fileName = getFileName(w.templateName);
    locationStr = ` at ${fileName}:${lineNum}${colNum}`;
  }

  let formatted: string;
  if (verbosity === 'simple') {
    formatted = `[WARNING] ${message}`;
  } else if (verbosity === 'medium') {
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}`;
  } else {
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}${code ? ` [${code}]` : ''}`;
  }

  return formatted;
};

export const injectWarningsScript = (warnings: Warning[], options: InjectWarningsOptions = {}): string => {
  const { dev = true, verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) return '';

  const consoleScripts = warnings.map(w => {
    const formatted = formatWarning(w, { verbosity });
    return `console.warn('[Nunjucks]', ${JSON.stringify(formatted)});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};

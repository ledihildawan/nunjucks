const getFileName = (path) => {
  if (!path) return 'unknown';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
};

const formatWarning = (w, options = {}) => {
  const { verbosity = 'full' } = options;
  const message = typeof w === 'string' ? w : w.message;
  const undefinedMode = w.undefinedMode || 'chainable';
  const code = w.code || null;

  let locationStr = '';
  if (w.lineno !== undefined && w.lineno !== null) {
    const lineNum = w.lineno + 1;
    const colNum = w.colno !== undefined && w.colno !== null ? `:${w.colno}` : '';
    const fileName = getFileName(w.templateName);
    locationStr = ` at ${fileName}:${lineNum}${colNum}`;
  }

  let formatted;
  if (verbosity === 'simple') {
    formatted = `[WARNING] ${message}`;
  } else if (verbosity === 'medium') {
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}`;
  } else {
    formatted = `[WARNING] ${message} (${undefinedMode})${locationStr}${code ? ` [${code}]` : ''}`;
  }

  return formatted;
};

export const injectWarningsScript = (warnings, options = {}) => {
  const { dev = true, verbosity = 'full' } = options;

  if (!warnings || warnings.length === 0) return '';

  const consoleScripts = warnings.map(w => {
    const formatted = formatWarning(w, { verbosity });
    return `console.warn('[Nunjucks]', ${JSON.stringify(formatted)});`;
  });

  return `<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];${consoleScripts.join('')}</script>`;
};
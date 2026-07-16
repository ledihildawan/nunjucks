import { shortenPath } from '../../shared/path-shortener.js';

/**
 * Get plain text error message (for logging/debugging)
 * @param {Error} error - Raw error from nunjucks
 * @param {object} options - Optional configuration
 * @returns {string} Plain text error message
 */
export const toText = (error, options = {}) => {
  if (!error) return '';

  const { verbosity = 'full', templatePath, lineno, colno } = options;

  let message = error.message;
  if (!message || typeof message !== 'string') {
    message = String(error);
  }

  const firstStackLine = message.indexOf('\n    at ');
  if (firstStackLine !== -1) {
    message = message.substring(0, firstStackLine);
  }

  if (verbosity === 'simple') {
    return message;
  }

  let locationStr = '';
  if (verbosity === 'medium' && (templatePath || lineno || colno)) {
    const path = templatePath || error.templateName || 'unknown';
    const line = lineno ?? error.lineno ?? 0;
    const col = colno ?? error.colno ?? 0;
    const shortPath = shortenPath(path);
    locationStr = ` at ${shortPath}:${line}:${col}`;
    return `${message}${locationStr}`;
  }

  // full verbosity - format stack trace
  const stack = error.stack || '';
  const stackLines = stack.split('\n').slice(1);

  const formattedStack = stackLines
    .map(line => {
      const trimmed = line.trim();
      const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/);
      if (pathMatch) {
        const fullPath = pathMatch[1];
        const lineNum = pathMatch[2];
        const shortPath = shortenPath(fullPath);
        const fnMatch = trimmed.match(/^at\s+([^\s]+)/);
        const fn = fnMatch ? fnMatch[1] : '';
        return fn ? `  at ${fn} (${shortPath}:${lineNum})` : `  at ${shortPath}:${lineNum}`;
      }
      return `  ${trimmed}`;
    })
    .join('\n');

  return formattedStack ? `${message}\n${formattedStack}` : message;
};

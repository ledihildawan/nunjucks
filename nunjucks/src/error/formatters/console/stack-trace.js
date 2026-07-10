import { shortenPath, normalizeDrivePath } from '../../path-shortener.js';
import { resolveIdeLink } from '../../constants/ide-links.js';
import picocolors from 'picocolors';

const makeHyperlink = (text, url) => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

export const formatStackTrace = (originalError, isProduction = false, ide = 'vscode') => {
  if (!originalError?.stack) return '';

  const stackLines = originalError.stack.split('\n').slice(1);
  if (stackLines.length === 0) return '';

  const jsStackLines = stackLines.filter(line => line.trim().startsWith('at '));
  if (jsStackLines.length === 0) return '';

  const linesToShow = isProduction
    ? jsStackLines.filter(line => {
        const path = line.toLowerCase();
        return !path.includes('nunjucks/nunjucks/src/') && !path.includes('nunjucks\\nunjucks\\src\\');
      })
    : jsStackLines;

  if (linesToShow.length === 0) return '';

  const makeLink = (path, line, col) => {
    const normalizedPath = normalizeDrivePath(path);
    const url = resolveIdeLink(ide, normalizedPath, line, col);
    const display = shortenPath(normalizedPath);
    const linkText = `${display}:${line}:${col}`;
    return makeHyperlink(linkText, url);
  };

  const shortenStackLine = (line) => {
    const trimmed = line.trim();
    return trimmed.replace(/\(([^()]+):(\d+):(\d+)\)$/, (_, path, l, c) => {
      const cleanPath = normalizeDrivePath(path);
      if (/^native$/.test(cleanPath) || /^<anonymous>$/.test(cleanPath) || !/[\\/]/.test(cleanPath)) {
        return `(${cleanPath}:${l}:${c})`;
      }
      return `(${makeLink(path, l, c)})`;
    });
  };

  const lines = ['\n', picocolors.bold('Stack Trace:')];
  for (const line of linesToShow) {
    lines.push(picocolors.dim('  ' + shortenStackLine(line)));
  }
  return lines.join('\n');
};

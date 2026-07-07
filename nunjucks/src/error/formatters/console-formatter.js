import { splitSnippetLines } from '../core/snippet-utils.js';
import { formatLocation, getDisplayMessage } from '../state/error-data.js';

let picocolors;
try {
  picocolors = require('picocolors');
} catch (e) {
  picocolors = null;
}

const pc = picocolors || {
  red: (s) => s,
  bold: (s) => s,
  dim: (s) => s,
  cyan: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  magenta: (s) => s,
  bgRed: (s) => s,
  white: (s) => s,
};

const formatHeader = () => [
  `${pc.bgRed('[ERROR]')} ${pc.bold('Template Rendering Failed')}`,
  pc.dim('─'.repeat(60))
].join('\n');

const formatMessage = (message) => `${pc.bold('Message:')} ${message}`;

const formatLocationLabel = (locationFile) =>
  `${pc.bold('Location:')} ${locationFile}`;

const formatCodeTrace = (traceLines) => {
  const lines = ['\n', pc.bold('Code Trace:')];
  for (const line of traceLines) {
    if (line.startsWith('>>>')) {
      lines.push(pc.red(line));
    } else {
      lines.push(pc.dim(line));
    }
  }
  return lines.join('\n');
};

const formatCauses = (causes) => {
  const lines = ['\n', pc.bold('Possible Causes:')];
  for (const cause of causes) {
    lines.push(pc.dim(`  • ${cause}`));
  }
  return lines.join('\n');
};

const formatFix = (fixComment, fixCode) => [
  '\n',
  `${pc.bold('Suggested Fix:')} ${pc.cyan(fixComment)}`,
  pc.dim('  ' + fixCode)
].join('\n');

const formatStackTrace = (originalError, isProduction = false) => {
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

  const lines = ['\n', pc.bold('Stack Trace:')];
  for (const line of linesToShow) {
    lines.push(pc.dim('  ' + line.trim()));
  }
  return lines.join('\n');
};

export const toConsoleString = (state) => {
  const {
    errorId,
    timestamp,
    snippet,
    classified,
    isProduction,
    originalError
  } = state;

  if (isProduction) {
    return `${pc.bgRed('[ERROR]')} Template Rendering Failed${errorId ? ` [${errorId}]` : ''}\n${pc.dim('Check logs for details')}`;
  }

  const locationFile = formatLocation(state);
  const traceLines = splitSnippetLines(snippet);
  const displayMessage = getDisplayMessage(state);

  const metaBits = [];
  if (errorId) metaBits.push(`id=${errorId}`);
  if (timestamp) metaBits.push(`at=${timestamp}`);
  const metaLine = metaBits.length ? pc.dim(`[${metaBits.join(' | ')}]`) : null;

  const parts = [
    formatHeader(),
    formatMessage(displayMessage),
    formatLocationLabel(locationFile)
  ];

  if (metaLine) {
    parts.splice(1, 0, metaLine);
  }

  if (traceLines.length > 0) {
    parts.push(formatCodeTrace(traceLines));
  }

  if (classified) {
    parts.push(formatCauses(classified.causes));
    parts.push(formatFix(classified.fixComment, classified.fixCode));
  }

  const stackTrace = formatStackTrace(originalError, isProduction);
  if (stackTrace) {
    parts.push(stackTrace);
  }

  parts.push('');

  return parts.join('\n');
};

import { classifyError } from '../core/classify.js';
import { splitSnippetLines } from '../core/snippet-utils.js';

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

const buildLocationFile = (templateName, includeChain, line, col) => {
  const displayLine = line !== null ? line : '?';
  const displayCol = col !== null ? col : '?';
  const lineCol = line !== null ? `:${displayLine}${col !== null ? `:${displayCol}` : ''}` : '';
  const mainLoc = templateName + lineCol;

  if (includeChain && includeChain.length > 0) {
    const first = includeChain[0];
    const parentLoc = `${first.parentTmpl}:${first.parentLineno}${first.parentColno ? `:${first.parentColno}` : ''}`;
    return `${mainLoc} ${pc.dim('(included from ' + parentLoc + ')')}`;
  }
  return mainLoc;
};

const buildDisplayMessage = (errorText, classified) => {
  if (!classified) return errorText;

  if (classified.category === 'undefined_variable') {
    return classified.undefinedName
      ? `Variable '${classified.undefinedName}' is undefined or null`
      : 'Variable is undefined or null';
  }

  if (classified.category === 'undefined_function') {
    return classified.undefinedName
      ? `Unable to call '${classified.undefinedName}', which is undefined or falsey`
      : 'Unable to call undefined function';
  }

  return errorText;
};

const formatHeader = () => [
  `${pc.bgRed('[ERROR]')} ${pc.bold('Template Rendering Failed')}`,
  pc.dim('─'.repeat(60))
].join('\n');

const formatMessage = (message) => `${pc.bold('Message:')} ${message}`;

const formatPosition = (displayLine, displayCol) =>
  `${pc.bold('Position:')} Line ${displayLine}, Col ${displayCol}`;

const formatLocation = (locationFile) =>
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
    message,
    errorId,
    timestamp,
    templateName,
    includeChain,
    snippet,
    classified,
    getDisplayLine,
    getDisplayCol,
    isProduction,
    originalError
  } = state;

  if (isProduction) {
    return `${pc.bgRed('[ERROR]')} Template Rendering Failed${errorId ? ` [${errorId}]` : ''}\n${pc.dim('Check logs for details')}`;
  }

  const locationFile = buildLocationFile(templateName, includeChain, getDisplayLine(), getDisplayCol());
  const traceLines = splitSnippetLines(snippet);

  const errorText = message.split('\n').find(l => l.match(/^  Error:/i))
    ?.replace(/^  Error:\s*/i, '') || message.split('\n').pop()?.trim() || message;

  const displayMessage = buildDisplayMessage(errorText, classified);

  const metaBits = [];
  if (errorId) metaBits.push(`id=${errorId}`);
  if (timestamp) metaBits.push(`at=${timestamp}`);
  const metaLine = metaBits.length ? pc.dim(`[${metaBits.join(' | ')}]`) : null;

  const parts = [
    formatHeader(),
    formatMessage(displayMessage),
    formatLocation(locationFile)
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

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

const buildLocationFile = (templateName, includeChain) => {
  if (includeChain && includeChain.length > 0) {
    const first = includeChain[0];
    return `${templateName} ${pc.dim('(included from ' + first.parentTmpl + ':' + first.parentLineno + (first.parentColno ? ':' + first.parentColno : '') + ')')}`;
  }
  return templateName;
};

const buildDisplayMessage = (errorText, classified) => {
  if (!classified) return errorText;

  if (classified.category === 'undefined_variable') {
    return classified.undefinedName
      ? `Variable '${classified.undefinedName}' is undefined or null`
      : 'Variable is undefined or null';
  }

  if (classified.category === 'undefined_function') {
    return `Unable to call '${classified.undefinedName}', which is undefined or falsey`;
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

export const toConsoleString = (state) => {
  const {
    message,
    templateName,
    includeChain,
    snippet,
    classified,
    getDisplayLine,
    getDisplayCol,
    isProduction
  } = state;

  if (isProduction) {
    return `${pc.bgRed('[ERROR]')} Template Rendering Failed\n${pc.dim('Check logs for details')}`;
  }

  const locationFile = buildLocationFile(templateName, includeChain);
  const traceLines = splitSnippetLines(snippet);

  const errorText = message.split('\n').find(l => l.match(/^  Error:/i))
    ?.replace(/^  Error:\s*/i, '') || message.split('\n').pop()?.trim() || message;

  const displayMessage = buildDisplayMessage(errorText, classified);

  const parts = [
    formatHeader(),
    formatMessage(displayMessage),
    formatPosition(getDisplayLine(), getDisplayCol()),
    formatLocation(locationFile)
  ];

  if (traceLines.length > 0) {
    parts.push(formatCodeTrace(traceLines));
  }

  if (classified) {
    parts.push(formatCauses(classified.causes));
    parts.push(formatFix(classified.fixComment, classified.fixCode));
  }

  parts.push('');

  return parts.join('\n');
};

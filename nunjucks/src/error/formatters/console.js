import { splitSnippetLines } from '../core/snippet.js';
import { formatLocation, getDisplayMessage } from '../state/display.js';

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

const renderMarkdownToAnsi = (text) => {
  if (!text) return '';
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_, code) => pc.cyan(code));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, bold) => pc.bold(bold));
  return s;
};

const formatHeader = (code) => {
  const badge = code ? ` ${pc.yellow(`[${code}]`)}` : '';
  return [
    `${pc.bgRed('[ERROR]')} ${pc.bold('Template Rendering Failed')}${badge}`,
    pc.dim('─'.repeat(60))
  ].join('\n');
};

const formatMessage = (message) => `${pc.bold('Message:')} ${message}`;

const formatLocationLabel = (locationFile) =>
  `${pc.bold('Location:')} ${locationFile}`;

const formatRenderContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx);
  if (keys.length === 0) return '';
  const lines = ['\n', pc.bold('Render Context:')];
  for (const k of keys) {
    const raw = ctx[k];
    const val = typeof raw === 'string' ? raw : JSON.stringify(raw);
    lines.push(pc.dim(`  ${k} = ${val}`));
  }
  return lines.join('\n');
};

const formatCodeTrace = (traceLines) => {
  const lines = ['\n', pc.bold('Source Trace:')];
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
    lines.push(`  ${pc.dim('•')} ${renderMarkdownToAnsi(cause)}`);
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
    code,
    phase,
    snippet,
    classified,
    isProduction,
    originalError,
    renderContext
  } = state;

  if (isProduction) {
    const badge = code ? ` [${code}]` : '';
    return `${pc.bgRed('[ERROR]')} Template Rendering Failed${badge}${errorId ? ` [${errorId}]` : ''}\n${pc.dim('Check logs for details')}`;
  }

  const locationFile = formatLocation(state);
  const traceLines = splitSnippetLines(snippet);
  const displayMessage = getDisplayMessage(state);

  const metaBits = [];
  if (phase) metaBits.push(`phase=${phase}`);
  if (errorId) metaBits.push(`id=${errorId}`);
  if (timestamp) metaBits.push(`at=${timestamp}`);
  const metaLine = metaBits.length ? pc.dim(`[${metaBits.join(' | ')}]`) : null;

  const parts = [
    formatHeader(code),
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

  const ctxBlock = formatRenderContext(renderContext);
  if (ctxBlock) {
    parts.push(ctxBlock);
  }

  const stackTrace = formatStackTrace(originalError, isProduction);
  if (stackTrace) {
    parts.push(stackTrace);
  }

  parts.push('');

  return parts.join('\n');
};

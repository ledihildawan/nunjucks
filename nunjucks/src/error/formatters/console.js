import { splitSnippetLines } from '../core/snippet.js';
import { formatLocation, getDisplayMessage } from '../state/message-formatter.js';

const FALLBACK_PICOLORS = {
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

let _pc = null;

const getPicocolors = () => {
  if (_pc !== null) return _pc;
  try {
    _pc = require('picocolors');
  } catch (e) {
    _pc = FALLBACK_PICOLORS;
  }
  return _pc;
};

const renderMarkdownToAnsi = (text) => {
  if (!text) return '';
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_, code) => getPicocolors().cyan(code));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, bold) => getPicocolors().bold(bold));
  return s;
};

const formatHeader = (code, phase) => {
  const bits = [`${getPicocolors().bgRed('[ERROR]')} ${getPicocolors().bold('Template Rendering Failed')}`];
  if (code) bits.push(getPicocolors().yellow(`[${code}]`));
  if (phase) bits.push(getPicocolors().dim(`(${phase})`));
  return [
    bits.join(' '),
    getPicocolors().dim('─'.repeat(60))
  ].join('\n');
};

const formatMessage = (message) => `${getPicocolors().bold('Message:')} ${message}`;

const formatLocationLabel = (locationFile) =>
  `${getPicocolors().bold('Location:')} ${locationFile}`;

const formatRenderContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx);
  if (keys.length === 0) return '';
  const lines = ['\n', getPicocolors().bold('Render Context:')];
  for (const k of keys) {
    const raw = ctx[k];
    const val = typeof raw === 'string' ? raw : JSON.stringify(raw);
    lines.push(getPicocolors().dim(`  ${k} = ${val}`));
  }
  return lines.join('\n');
};

const formatCodeTrace = (traceLines) => {
  const lines = ['\n', getPicocolors().bold('Source Trace:')];
  for (const line of traceLines) {
    const cleanLine = line.startsWith('>>>') ? line.slice(4) : line;
    if (line.startsWith('>>>')) {
      lines.push(getPicocolors().red(cleanLine));
    } else {
      lines.push(getPicocolors().dim(line));
    }
  }
  return lines.join('\n');
};

const formatCauses = (causes) => {
  const lines = ['\n', getPicocolors().bold('Possible Causes:')];
  for (const cause of causes) {
    lines.push(`  ${getPicocolors().dim('•')} ${renderMarkdownToAnsi(cause)}`);
  }
  return lines.join('\n');
};

const formatFix = (fixComment, fixCode) => [
  '\n',
  `${getPicocolors().bold('Suggested Fix:')} ${getPicocolors().cyan(fixComment)}`,
  getPicocolors().dim('  ' + fixCode)
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

  const lines = ['\n', getPicocolors().bold('Stack Trace:')];
  for (const line of linesToShow) {
    lines.push(getPicocolors().dim('  ' + line.trim()));
  }
  return lines.join('\n');
};

export const toConsoleString = (state) => {
  const {
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
    const fp = state.fingerprint ? ` [#${state.fingerprint}]` : '';
    const metaBits = [];
    if (state.version) metaBits.push(`Nunjucks ${state.version}`);
    if (state.timestamp) metaBits.push(state.timestamp);
    const metaLine = metaBits.length ? getPicocolors().dim('\n' + metaBits.join(' · ')) : '';
    return `${getPicocolors().bgRed('[ERROR]')} Template Rendering Failed${badge}${fp}${metaLine}\n${getPicocolors().dim('Check logs for details')}`;
  }

  const locationFile = formatLocation(state);
  const traceLines = splitSnippetLines(snippet);
  const displayMessage = getDisplayMessage(state);

  const parts = [
    formatHeader(code, phase),
    formatMessage(displayMessage),
    formatLocationLabel(locationFile)
  ];

  if (traceLines.length > 0) {
    parts.push(formatCodeTrace(traceLines));
  }

  parts.push(formatCauses(classified.causes));
  parts.push(formatFix(classified.fixComment, classified.fixCode));

  const ctxBlock = formatRenderContext(renderContext);
  if (ctxBlock) {
    parts.push(ctxBlock);
  }

  const stackTrace = formatStackTrace(originalError, isProduction);
  if (stackTrace) {
    parts.push(stackTrace);
  }

  const footerBits = [];
  footerBits.push(`Nunjucks ${state.version || '3.2.4'}`);
  if (state.fingerprint) footerBits.push(`#${state.fingerprint}`);
  if (state.timestamp) footerBits.push(state.timestamp);
  parts.push(getPicocolors().dim('\n' + footerBits.join(' · ') + ' [DEV]'));

  parts.push('');

  return parts.join('\n');
};

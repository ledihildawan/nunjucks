import { splitSnippetLines } from '../core/snippet.js';
import { formatLocation, getDisplayMessage } from '../state/message-formatter.js';
import { shortenPath, normalizeDrivePath } from '../../shared/path-shortener.js';
import { resolveIdeLink } from '../constants/ide-links.js';
import { formatStackTrace } from './console/stack-trace.js';
import picocolors from 'picocolors';

const makeHyperlink = (text, url) => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

const renderMarkdownToAnsi = (text) => {
  if (!text) return '';
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_, code) => picocolors.cyan(code));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, bold) => picocolors.bold(bold));
  return s;
};

const formatHeader = (code, phase) => {
  const bits = [`${picocolors.bgRed('[ERROR]')} ${picocolors.bold('Template Rendering Failed')}`];
  if (code) bits.push(picocolors.yellow(`[${code}]`));
  if (phase) bits.push(picocolors.dim(`(${phase})`));
  bits.push(picocolors.dim('[DEV]'));
  return [
    bits.join(' '),
    picocolors.dim('─'.repeat(60))
  ].join('\n');
};

const formatMessage = (message) => `${picocolors.bold('Message:')} ${message}`;

const formatLocationLabel = (state) => {
  const { templatePath, getDisplayLine, getDisplayCol } = state;
  const line = getDisplayLine();
  const col = getDisplayCol();

  if (templatePath) {
    const normalizedPath = normalizeDrivePath(templatePath);
    const url = resolveIdeLink(state.ide || 'vscode', normalizedPath, line, col);
    const display = shortenPath(normalizedPath);
    const linkText = `${display}:${line}:${col}`;
    const link = makeHyperlink(linkText, url);
    return `${picocolors.bold('Location:')} ${link}`;
  }

  const locationFile = formatLocation(state);
  return `${picocolors.bold('Location:')} ${shortenPath(locationFile)}`;
};

const formatRenderContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx).filter(k => !k.startsWith('__nunjucks'));
  if (keys.length === 0) return '';
  const lines = ['\n', picocolors.bold('Render Context:')];
  for (const k of keys) {
    const raw = ctx[k];
    let val;
    if (raw === undefined) {
      val = 'undefined';
    } else if (raw === null) {
      val = 'null';
    } else if (typeof raw === 'string') {
      val = raw;
    } else {
      val = JSON.stringify(raw);
    }
    lines.push(picocolors.dim(`  ${k} = ${val}`));
  }
  return lines.join('\n');
};

const formatCodeTrace = (traceLines) => {
  const lines = ['\n', picocolors.bold('Source Trace:')];
  for (const line of traceLines) {
    const cleanLine = line.startsWith('>>>') ? line.slice(4) : line;
    if (line.startsWith('>>>')) {
      lines.push(picocolors.red(cleanLine));
    } else {
      lines.push(picocolors.dim(line));
    }
  }
  return lines.join('\n');
};

const formatCauses = (causes) => {
  const lines = ['\n', picocolors.bold('Possible Causes:')];
  for (const cause of causes) {
    lines.push(`  ${picocolors.dim('•')} ${renderMarkdownToAnsi(cause)}`);
  }
  return lines.join('\n');
};

const formatFix = (fixComment, fixCode) => [
  '\n',
  `${picocolors.bold('Suggested Fix:')} ${picocolors.cyan(fixComment)}`,
  picocolors.dim('  ' + fixCode)
].join('\n');

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
    const metaBits = [];
    if (state.version) metaBits.push(`Nunjucks ${state.version}`);
    if (state.timestamp) metaBits.push(state.timestamp);
    const metaLine = metaBits.length ? picocolors.dim('\n' + metaBits.join(' · ')) : '';
    return `${picocolors.bgRed('[ERROR]')} Template Rendering Failed${badge}${metaLine}\n${picocolors.dim('Check logs for details')}`;
  }

  const traceLines = splitSnippetLines(snippet);
  const displayMessage = getDisplayMessage(state);

  const parts = [
    formatHeader(code, phase),
    formatMessage(displayMessage),
    formatLocationLabel(state)
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

  const stackTrace = formatStackTrace(originalError, isProduction, state.ide);
  if (stackTrace) {
    parts.push(stackTrace);
  }

  const footerBits = [];
  footerBits.push(`Nunjucks ${state.version || '3.2.4'}`);
  if (state.timestamp) footerBits.push(state.timestamp);
  parts.push(picocolors.dim('\n' + footerBits.join(' · ')));

  parts.push('');

  return parts.join('\n');
};

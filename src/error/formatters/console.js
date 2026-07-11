import { keys, filter } from 'remeda';
import { splitSnippetLines } from '../core/snippet.js';
import { formatLocation, getDisplayMessage } from '../state/message-formatter.js';
import { shortenPath, normalizeDrivePath } from '../../shared/path-shortener.js';
import { resolveIdeLink } from '../constants/ide-links.js';
import { formatStackTrace } from './console/stack-trace.js';
import { isBlockedKey } from '../../shared/blocked-keys.js';
import picocolors from 'picocolors';

const CONSOLE_JS_RULES = [
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.)*`/ },
  { type: 'number', re: /^\d+\.?\d*/ },
  { type: 'keyword', re: /^(?:async|await|function|return|if|else|for|while|const|let|var|class|import|export|from|default|try|catch|throw|new|this|typeof|instanceof|null|undefined|true|false)/ },
  { type: 'comment', re: /^\/\/.*/ },
  { type: 'operator', re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\})/ },
];

const highlightJsToAnsi = (code) => {
  if (!code) return '';
  let out = '';
  let i = 0;
  const span = (type, text) => {
    const colors = {
      string: picocolors.cyan,
      number: picocolors.yellow,
      keyword: picocolors.magenta,
      comment: picocolors.dim,
      operator: picocolors.white,
    };
    return (colors[type] || picocolors.white)(text);
  };
  while (i < code.length) {
    const rest = code.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) { out += ws[0]; i += ws[0].length; continue; }
    let matched = false;
    for (const rule of CONSOLE_JS_RULES) {
      const m = rest.match(rule.re);
      if (m && m[0]) {
        out += span(rule.type, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += code[i]; i += 1; }
  }
  return out;
};

const CONSOLE_TEMPLATE_RULES = [
  { type: 'tag', re: /^(\{%-?|\%-?|\{%|#\{)/ },
  { type: 'variable', re: /^(\{\{-?|\{\{-|#\{)/ },
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { type: 'number', re: /^\d+\.?\d*/ },
  { type: 'filter', re: /^\|\s*\w+/ },
  { type: 'keyword', re: /^(?:true|false|null|undefined|and|or|not|in|is|as|import)/ },
  { type: 'operator', re: /^(?:==|!=|>=|<=|\.\.|::|\?:|==|!)/ },
  { type: 'punctuation', re: /^[\[\]{}(),:]/ },
];

const highlightTemplateToAnsi = (code) => {
  if (!code) return '';
  let out = '';
  let i = 0;
  const span = (type, text) => {
    const colors = {
      tag: picocolors.red,
      variable: picocolors.red,
      string: picocolors.cyan,
      number: picocolors.yellow,
      filter: picocolors.green,
      keyword: picocolors.magenta,
      operator: picocolors.white,
      punctuation: picocolors.dim,
    };
    return (colors[type] || picocolors.white)(text);
  };
  while (i < code.length) {
    const rest = code.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) { out += ws[0]; i += ws[0].length; continue; }
    let matched = false;
    for (const rule of CONSOLE_TEMPLATE_RULES) {
      const m = rest.match(rule.re);
      if (m && m[0]) {
        out += span(rule.type, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += code[i]; i += 1; }
  }
  return out;
};

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
  const { templatePath, getDisplayLine, getDisplayCol, jsCaller } = state;
  const line = getDisplayLine();
  const col = getDisplayCol();

  if (jsCaller && templatePath && !templatePath.match(/\.(html|njk|j2|tmpl)$/i)) {
    const normalizedPath = normalizeDrivePath(templatePath);
    const url = resolveIdeLink(state.ide || 'vscode', normalizedPath, 1, col && col !== '?' ? parseInt(col, 10) : 1);
    const display = shortenPath(normalizedPath);
    const linkText = col && col !== '?' ? `${display}:${col}` : display;
    const link = makeHyperlink(linkText, url);
    return `${picocolors.bold('Location:')} ${link}`;
  }

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
  const filteredKeys = filter(keys(ctx), k => !k.startsWith('__nunjucks') && !isBlockedKey(k));
  if (filteredKeys.length === 0) return '';
  const lines = ['\n', picocolors.bold('Render Context:')];
  for (const k of filteredKeys) {
    const raw = ctx[k];
    let val;
    if (raw === undefined) {
      val = 'undefined';
    } else if (raw === null) {
      val = 'null';
    } else if (typeof raw === 'string') {
      val = raw;
    } else if (typeof raw === 'object') {
      val = JSON.stringify(raw, (k2, v) => isBlockedKey(k2) ? undefined : v);
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
    const highlighted = highlightTemplateToAnsi(cleanLine);
    if (line.startsWith('>>>')) {
      lines.push(picocolors.red(highlighted));
    } else {
      lines.push(picocolors.dim(highlighted));
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
    renderContext,
    jsCallerLines
  } = state;

  if (isProduction) {
    const badge = code ? ` [${code}]` : '';
    const metaBits = [];
    if (state.version) metaBits.push(`Nunjucks ${state.version}`);
    if (state.timestamp) metaBits.push(state.timestamp);
    const metaLine = metaBits.length ? picocolors.dim('\n' + metaBits.join(' · ')) : '';
    return `${picocolors.bgRed('[ERROR]')} Template Rendering Failed${badge}${metaLine}\n${picocolors.dim('Check logs for details')}`;
  }

  const displayMessage = getDisplayMessage(state);

  const parts = [
    formatHeader(code, phase),
    formatMessage(displayMessage),
    formatLocationLabel(state)
  ];

  if (jsCallerLines && jsCallerLines.length > 0) {
    const jsTraceLabel = picocolors.bold('Source Trace:');
    const jsTraceLines = jsCallerLines.map(({ lineNum, code, isError }) => {
      const highlighted = highlightJsToAnsi(code);
      const lineText = '  ' + lineNum + ':' + highlighted;
      return isError ? picocolors.red(lineText) : picocolors.dim(lineText);
    });
    parts.push('', jsTraceLabel, ...jsTraceLines);
  } else if (snippet) {
    const traceLines = splitSnippetLines(snippet);
    if (traceLines.length > 0) {
      parts.push(formatCodeTrace(traceLines));
    }
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

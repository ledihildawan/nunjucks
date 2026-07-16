import { keys, filter } from 'remeda';
import { classify } from './classify.js';
import { toText } from './to-text.js';
import { isBlockedKey } from '../../shared/blocked-keys.js';
import { shortenPath, normalizeDrivePath } from '../../shared/path-shortener.js';
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
  { type: 'tag', re: /^(?:\{%-?|%-?|\{%|#\{)/ },
  { type: 'variable', re: /^(\{\{-?|\{\{-|#\{)/ },
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { type: 'number', re: /^\d+\.?\d*/ },
  { type: 'filter', re: /^\|\s*\w+/ },
  { type: 'keyword', re: /^(?:true|false|null|undefined|and|or|not|in|is|as|import)/ },
  { type: 'operator', re: /^(?:==|!=|>=|<=|\.\.|::|\?:|==|!)/ },
  { type: 'punctuation', re: /^[\](){},:]/ },
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

const formatHeader = (category, phase) => {
  const bits = [`${picocolors.bgRed('[ERROR]')} ${picocolors.bold('Template Rendering Failed')}`];
  if (category) bits.push(picocolors.yellow(`[${category}]`));
  if (phase) bits.push(picocolors.dim(`(${phase})`));
  bits.push(picocolors.dim('[DEV]'));
  return [
    bits.join(' '),
    picocolors.dim('─'.repeat(60))
  ].join('\n');
};

const formatMessage = (message) => `${picocolors.bold('Message:')} ${message}`;

const formatLocationLabel = (options, error) => {
  const { templatePath = error?.templateName, jsCaller, jsCallerErrorLine, ide = 'vscode' } = options;
  const lineno = (options.lineno ?? error?.lineno ?? 0) + 1;
  const colno = (options.colno ?? error?.colno ?? 0) + 1;

  if (!templatePath) {
    return `${picocolors.bold('Location:')} ${picocolors.dim('unknown')}`;
  }

  const line = lineno;
  const col = colno;
  const shortPath = shortenPath(templatePath);
  const displayPath = `${shortPath}:${line}:${col}`;
  const normalizedPath = normalizeDrivePath(templatePath);
  const vscodeUrl = `vscode://file/${normalizedPath}:${line}:${col}`;
  const link = makeHyperlink(displayPath, vscodeUrl);

  return `${picocolors.bold('Location:')} ${link}`;
};

const formatRenderContext = (renderContext) => {
  if (!renderContext || typeof renderContext !== 'object') return '';
  const filteredKeys = filter(keys(renderContext), k => !k.startsWith('__nunjucks') && !isBlockedKey(k));
  if (filteredKeys.length === 0) return '';
  const lines = ['\n', picocolors.bold('Render Context:')];
  for (const k of filteredKeys) {
    const raw = renderContext[k];
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

const formatCodeTrace = (snippet, errorIndex = -1, startLine = 1) => {
  if (!snippet) return '';
  const lines = ['\n', picocolors.bold('Source Trace:')];
  const snippetLines = snippet.split('\n');
  for (let i = 0; i < snippetLines.length; i++) {
    const lineNum = startLine + i;
    const line = snippetLines[i];
    const highlighted = highlightTemplateToAnsi(line);
    const prefix = i === errorIndex ? picocolors.red(`${lineNum} | `) : picocolors.dim(`${lineNum} | `);
    if (i === errorIndex) {
      lines.push(prefix + highlighted);
    } else {
      lines.push(prefix + highlighted);
    }
  }
  return lines.join('\n');
};

const formatCauses = (causes) => {
  if (!causes || causes.length === 0) return '';
  const lines = ['\n', picocolors.bold('Possible Causes:')];
  for (const cause of causes) {
    lines.push(`  ${picocolors.dim('•')} ${renderMarkdownToAnsi(cause)}`);
  }
  return lines.join('\n');
};

const formatFix = (fixComment, fixCode) => {
  if (!fixComment && !fixCode) return '';
  return [
    '\n',
    picocolors.bold('Suggested Fix:'),
    fixComment ? '  ' + renderMarkdownToAnsi(fixComment) : '',
    fixCode ? '  ' + highlightTemplateToAnsi(fixCode) : ''
  ].filter(Boolean).join('\n');
};

const formatStackTrace = (error, isProduction = false) => {
  if (!error?.stack) return '';

  const stackLines = error.stack.split('\n').slice(1);
  if (stackLines.length === 0) return '';

  const jsStackLines = stackLines.filter(line => line.trim().startsWith('at '));
  if (jsStackLines.length === 0) return '';

  const visibleLines = isProduction
    ? jsStackLines.filter(line => {
        const path = line.toLowerCase();
        return !path.includes('nunjucks/nunjucks/src/') && !path.includes('nunjucks\\nunjucks\\src\\');
      })
    : jsStackLines;

  if (visibleLines.length === 0) return '';

  const lines = ['\n', picocolors.bold('Stack Trace:')];

  for (const frame of visibleLines) {
    const trimmed = frame.trim();
    const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/);
    if (pathMatch) {
      let fullPath = pathMatch[1];
      const line = pathMatch[2];
      const col = pathMatch[3];
      const shortPath = shortenPath(fullPath);
      const fnMatch = trimmed.match(/^at\s+([^\s]+)/);
      const fn = fnMatch ? fnMatch[1] : '';
      const linkText = fn ? `${fn} (${shortPath}:${line}:${col})` : `(${shortPath}:${line}:${col})`;
      const normalizedPath = normalizeDrivePath(fullPath);
      const vscodeUrl = `vscode://file/${normalizedPath}:${line}:${col}`;
      const link = makeHyperlink(linkText, vscodeUrl);
      lines.push(picocolors.dim(`  ${link}`));
    } else {
      lines.push(picocolors.dim(`  ${trimmed}`));
    }
  }

  return lines.join('\n');
};

const formatFooter = (options) => {
  const { version = '3.2.4', timestamp } = options;
  const bits = [`Nunjucks ${version}`];
  if (timestamp) bits.push(timestamp);
  return picocolors.dim('\n' + bits.join(' · '));
};

/**
 * Render error to ANSI-colored console output
 * @param {Error} error - Raw error from nunjucks
 * @param {object} options - Optional configuration
 * @returns {string} ANSI-colored string
 */
export const toAnsi = (error, options = {}) => {
  if (!error) return '';

  const {
    templatePath = error.templateName || null,
    lineno = error.lineno,
    colno = error.colno,
    renderContext,
    phase = error.phase,
    version,
    timestamp,
    sourceContent,
    snippet,
    verbosity = 'full'
  } = options;

  if (options.isProduction) {
    const badge = error.code ? ` [${error.code}]` : '';
    return `${picocolors.bgRed('[ERROR]')} Template Rendering Failed${badge}\n${picocolors.dim('Check logs for details')}`;
  }

  const classified = classify(error);
  const plain = toText(error, { verbosity: 'simple' });

  const displayLine = (lineno ?? error?.lineno ?? 0) + 1;

  // Auto-generate snippet from sourceContent if not provided
  let codeSnippet = snippet;
  let errorIndex = -1;
  let startLine = 1;
  if (!codeSnippet && sourceContent) {
    const lines = sourceContent.split('\n');
    startLine = Math.max(0, displayLine - 3) + 1;
    const endLine = Math.min(lines.length, displayLine + 2);
    codeSnippet = lines.slice(startLine - 1, endLine).join('\n');
    errorIndex = displayLine - startLine;
  }

  const category = error.code || classified?.category?.toUpperCase() || 'UNKNOWN';

  const parts = [];

  if (verbosity === 'simple') {
    parts.push(formatMessage(plain));
    parts.push('');
    return parts.join('\n');
  }

  parts.push(formatHeader(category, phase));
  parts.push(formatMessage(plain));
  parts.push(formatLocationLabel(options, error));

  if (verbosity === 'medium') {
    parts.push(formatFooter(options));
    parts.push('');
    return parts.join('\n');
  }

  // full verbosity
  if (codeSnippet) {
    parts.push(formatCodeTrace(codeSnippet, errorIndex, startLine));
  }

  if (classified?.causes) {
    parts.push(formatCauses(classified.causes));
  }

  if (classified?.fixComment || classified?.fixCode) {
    parts.push(formatFix(classified.fixComment, classified.fixCode));
  }

  if (renderContext) {
    const ctxBlock = formatRenderContext(renderContext);
    if (ctxBlock) {
      parts.push(ctxBlock);
    }
  }

  parts.push(formatStackTrace(error, options.isProduction));

  parts.push(formatFooter(options));
  parts.push('');

  return parts.join('\n');
};

import { keys, filter } from 'remeda';
import { classify } from './classify.ts';
import type { ClassifiedError } from './classify.ts';
import { toText } from './to-text.ts';
import { isBlockedKey } from '@nunjucks/shared/blocked-keys';
import { shortenPath, normalizeDrivePath } from '@nunjucks/shared/path-shortener';
import picocolors from 'picocolors';
import { toDisplayLocation } from './location.ts';

interface JsRule {
  type: string;
  re: RegExp;
}

interface TemplateRule {
  type: string;
  re: RegExp;
}

const CONSOLE_JS_RULES: JsRule[] = [
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.)*`/ },
  { type: 'number', re: /^\d+\.?\d*/ },
  { type: 'keyword', re: /^(?:async|await|function|return|if|else|for|while|const|let|var|class|import|export|from|default|try|catch|throw|new|this|typeof|instanceof|null|undefined|true|false)/ },
  { type: 'comment', re: /^\/\/.*/ },
  { type: 'operator', re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\})/ },
];

const highlightJsToAnsi = (code: string): string => {
  if (!code) return '';
  let out = '';
  let i = 0;
  const span = (type: string, text: string) => {
    const colors: Record<string, (text: string) => string> = {
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

const CONSOLE_TEMPLATE_RULES: TemplateRule[] = [
  { type: 'tag', re: /^(?:\{%-?|%-?|\{%|#\{)/ },
  { type: 'variable', re: /^(\{\{-?|\{\{-|#\{)/ },
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/ },
  { type: 'number', re: /^\d+\.?\d*/ },
  { type: 'filter', re: /^\|\s*\w+/ },
  { type: 'keyword', re: /^(?:true|false|null|undefined|and|or|not|in|is|as|import)/ },
  { type: 'operator', re: /^(?:==|!=|>=|<=|\.\.|::|\?:|==|!)/ },
  { type: 'punctuation', re: /^[\](){},:]/ },
];

const highlightTemplateToAnsi = (code: string): string => {
  if (!code) return '';
  let out = '';
  let i = 0;
  const span = (type: string, text: string) => {
    const colors: Record<string, (text: string) => string> = {
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

const makeHyperlink = (text: string, url: string): string => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

const renderMarkdownToAnsi = (text: string): string => {
  if (!text) return '';
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_, code) => picocolors.cyan(code));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, bold) => picocolors.bold(bold));
  return s;
};

const formatHeader = (category: string | undefined, phase: string | null | undefined): string => {
  const bits = [`${picocolors.bgRed('[ERROR]')} ${picocolors.bold('Template Rendering Failed')}`];
  if (category) bits.push(picocolors.yellow(`[${category}]`));
  if (phase) bits.push(picocolors.dim(`(${phase})`));
  bits.push(picocolors.dim('[DEV]'));
  return [
    bits.join(' '),
    picocolors.dim('─'.repeat(60))
  ].join('\n');
};

const formatMessage = (message: string): string => `${picocolors.bold('Message:')} ${message}`;

const formatLocationLabel = (options: ToAnsiOptions, error: ErrorLike): string => {
  const { templatePath = error?.templateName, ide = 'vscode' } = options;
  const location = toDisplayLocation(
    options.lineno ?? error?.lineno ?? null,
    options.colno ?? error?.colno ?? null,
    options.isJsCaller ? 'one' : (options.lineBase ?? error?.lineBase ?? 'zero')
  );

  if (!templatePath) {
    return `${picocolors.bold('Location:')} ${picocolors.dim('unknown')}`;
  }

  const line = location.line;
  const col = location.col;
  const shortPath = shortenPath(templatePath);
  const displayPath = `${shortPath}:${line}:${col}`;
  const normalizedPath = normalizeDrivePath(templatePath);
  const vscodeUrl = `vscode://file/${normalizedPath}:${line}:${col}`;
  const link = makeHyperlink(displayPath, vscodeUrl);

  return `${picocolors.bold('Location:')} ${link}`;
};

const formatRenderContext = (renderContext: RenderContext): string => {
  if (!renderContext || typeof renderContext !== 'object') return '';
  const filteredKeys = filter(keys(renderContext), (k: string) => !k.startsWith('__nunjucks') && !isBlockedKey(k));
  if (filteredKeys.length === 0) return '';
  const lines: string[] = ['\n', picocolors.bold('Render Context:')];
  for (const k of filteredKeys) {
    const raw = renderContext[k];
    let val: string;
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

const isScriptPath = (filePath?: string | null): boolean =>
  /\.(?:[cm]?[jt]sx?|mjs|cjs)$/i.test(filePath || '');

const highlightSourceToAnsi = (code: string, filePath?: string | null): string =>
  isScriptPath(filePath) ? highlightJsToAnsi(code) : highlightTemplateToAnsi(code);

const formatCodeTrace = (snippet: string, errorIndex = -1, startLine = 1, sourcePath?: string | null): string => {
  if (!snippet) return '';
  const lines: string[] = ['\n', picocolors.bold('Source Trace:')];
  const snippetLines = snippet.split('\n');
  for (let i = 0; i < snippetLines.length; i++) {
    const lineNum = startLine + i;
    const line = snippetLines[i] ?? '';
    const highlighted = highlightSourceToAnsi(line, sourcePath);
    const prefix = i === errorIndex ? picocolors.red(`${lineNum} | `) : picocolors.dim(`${lineNum} | `);
    if (i === errorIndex) {
      lines.push(prefix + highlighted);
    } else {
      lines.push(prefix + highlighted);
    }
  }
  return lines.join('\n');
};

const formatCauses = (causes: string[] | undefined): string => {
  if (!causes || causes.length === 0) return '';
  const lines: string[] = ['\n', picocolors.bold('Possible Causes:')];
  for (const cause of causes) {
    lines.push(`  ${picocolors.dim('•')} ${renderMarkdownToAnsi(cause)}`);
  }
  return lines.join('\n');
};

const formatFix = (fixComment: string | null | undefined, fixCode: string | null | undefined): string => {
  if (!fixComment && !fixCode) return '';
  return [
    '\n',
    picocolors.bold('Suggested Fix:'),
    fixComment ? '  ' + renderMarkdownToAnsi(fixComment) : '',
    fixCode ? '  ' + highlightTemplateToAnsi(fixCode) : ''
  ].filter(Boolean).join('\n');
};

const formatStackTrace = (error: ErrorLike, isProduction = false): string => {
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

  const lines: string[] = ['\n', picocolors.bold('Stack Trace:')];

  for (const frame of visibleLines) {
    const trimmed = frame.trim();
    const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/);
    if (pathMatch?.[1] && pathMatch[2] && pathMatch[3]) {
      const fullPath = pathMatch[1];
      const line = pathMatch[2];
      const col = pathMatch[3];
      const shortPath = shortenPath(fullPath);
      const fnMatch = trimmed.match(/^at\s+([^\s]+)/);
      const fn = fnMatch?.[1] ?? '';
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

const formatFooter = (options: ToAnsiOptions): string => {
  const { version = '3.2.4', timestamp } = options;
  const bits = [`Nunjucks ${version}`];
  if (timestamp) bits.push(timestamp);
  return picocolors.dim('\n' + bits.join(' · '));
};

interface ErrorLike {
  message?: string;
  stack?: string;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
  phase?: string | null;
  code?: string | null;
  lineBase?: 'zero' | 'one' | null;
}

type RenderContext = Record<string, unknown>;

export interface ToAnsiOptions {
  templatePath?: string | null;
  lineno?: number | null;
  colno?: number | null;
  renderContext?: RenderContext;
  phase?: string | null;
  version?: string;
  timestamp?: string;
  sourceContent?: string;
  sourceStartLine?: number;
  snippet?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isProduction?: boolean;
  dev?: boolean;
  ide?: string;
  jsCaller?: string;
  jsCallerErrorLine?: number;
  lineBase?: 'zero' | 'one' | null;
  isJsCaller?: boolean;
}

export const toAnsi = (error: ErrorLike, options: ToAnsiOptions = {}): string => {
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
    sourceStartLine,
    snippet,
    verbosity = 'full',
    isJsCaller = false,
    lineBase = error?.lineBase ?? 'zero'
  } = options;

  if (options.isProduction) {
    const badge = error.code ? ` [${error.code}]` : '';
    return `${picocolors.bgRed('[ERROR]')} Template Rendering Failed${badge}\n${picocolors.dim('Check logs for details')}`;
  }

  const classified = classify(error as Parameters<typeof classify>[0]);
  const plain = toText(error, { verbosity: 'simple' });

  const location = toDisplayLocation(
    lineno ?? error?.lineno ?? null,
    colno ?? error?.colno ?? null,
    isJsCaller ? 'one' : lineBase
  );
  const displayLine = location.line;

  let codeSnippet = snippet;
  let errorIndex = -1;
  let startLine = 1;
  if (!codeSnippet && sourceContent) {
    const lines = sourceContent.split('\n');
    const relativeLine = sourceStartLine ? displayLine - sourceStartLine + 1 : displayLine;
    const clampedLine = Math.max(1, Math.min(relativeLine, lines.length));
    const startIndex = Math.max(0, clampedLine - 3);
    startLine = sourceStartLine ? sourceStartLine + startIndex : startIndex + 1;
    const endLine = Math.min(lines.length, clampedLine + 2);
    codeSnippet = lines.slice(startIndex, endLine).join('\n');
    errorIndex = clampedLine - startIndex - 1;
  }

  const category = error.code || classified?.category?.toUpperCase() || 'UNKNOWN';

  const parts: string[] = [];

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

  if (codeSnippet) {
    parts.push(formatCodeTrace(codeSnippet, errorIndex, startLine, templatePath));
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

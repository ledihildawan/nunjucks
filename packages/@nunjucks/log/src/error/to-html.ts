import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classify } from './classify.ts';
import type { ClassifiedError } from './classify.ts';
import { toText } from './to-text.ts';
import { escapeHtml, highlightHtml, highlightJs } from './formatters/html/highlight.ts';
import { renderContextHtml, formatStackTraceHtml } from './formatters/html/sections.ts';
import { CSS, PRODUCTION_BODY } from './formatters/html/styles.ts';
import { TOGGLE_SCRIPT } from './formatters/html/script.ts';
import { resolveIdeLink, getIdeMeta } from './ide-links.ts';
import { toDisplayLocation } from '../shared/location.ts';
import { calculateCaretPosition } from '../shared/caret.ts';
import { shortenPath } from '@nunjucks/shared/path-shortener';

export { CSS, PRODUCTION_BODY, TOGGLE_SCRIPT };

interface Csp {
  nonce?: string;
}

const document = (title: string, body: string, scripts = '', csp: Csp | null = null): string => {
  const styleNonce = csp?.nonce ? ` nonce="${csp.nonce}"` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style${styleNonce}>
body{margin:0;min-block-size:100dvh;padding:1rem;background:var(--color-bg-page);color:var(--color-text-primary);font-family:system-ui,-apple-system,sans-serif}
${CSS}
</style>
</head>
<body>
${body}
${scripts}
</body>
</html>`;
};

const buildProductionBody = (options: ToHtmlOptions): string => {
  const ref = options.timestamp ? `<p class="prod-ref">${escapeHtml(options.timestamp)}</p>` : '';
  return `
<main class="prod-main">
  <div class="prod-icon">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-error-border)" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <h1 class="prod-title">Rendering Interrupted</h1>
  <p class="prod-desc">An error occurred during template rendering.</p>
  <p class="prod-status">500 · Internal Server Error</p>
  <a href="" class="prod-btn">Try Again</a>
  ${ref}
</main>`;
};

const renderMarkdownToAnsi = (text: string): string => {
  if (!text) return '';
  let s = text;
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
};

interface ErrorLike {
  message?: string;
  stack?: string;
  lineno?: number | null;
  colno?: number | null;
  templateName?: string | null;
  sourceContent?: string;
  phase?: string | null;
  code?: string | null;
  lineBase?: 'zero' | 'one' | null;
}

export interface ToHtmlOptions {
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  renderContext?: object;
  phase?: string | null;
  version?: string;
  timestamp?: string;
  csp?: Csp;
  jsCaller?: string;
  jsCallerErrorLine?: number;
  sourceContent?: string;
  sourceStartLine?: number;
  snippet?: string;
  ide?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isJsCaller?: boolean;
  isProduction?: boolean;
}

const isScriptPath = (filePath?: string | null): boolean =>
  /\.(?:[cm]?[jt]sx?|mjs|cjs)$/i.test(filePath || '');

const highlightSource = (code: string, filePath?: string | null): string =>
  isScriptPath(filePath) ? highlightJs(code) : highlightHtml(code);

export const toHtml = (error: ErrorLike | null, options: ToHtmlOptions = {}): string => {
  const {
    templatePath = error?.templateName,
    lineno,
    colno,
    renderContext,
    phase,
    version = '3.2.4',
    timestamp,
    csp,
    jsCaller,
    jsCallerErrorLine,
    sourceContent = error?.sourceContent,
    sourceStartLine,
    snippet,
    ide = 'vscode',
    verbosity = 'full',
    isJsCaller = false
  } = options;

  if (!error) {
    return document('Error', buildProductionBody(options), '', csp ?? null);
  }

  if (options.isProduction) {
    return document('Rendering Interrupted', buildProductionBody(options), '', csp ?? null);
  }

  const classified = classify(error as Parameters<typeof classify>[0]);
  const plain = toText(error, { verbosity: 'simple' });

  const category = error.code || classified?.category?.toUpperCase() || 'UNKNOWN';
  const undefinedName = classified?.undefinedName || plain.match(/attempted to output '([^']+)'/)?.[1] || null;

  let humanTitle = classified?.title || plain;
  if (category === 'UNDEFINED_VARIABLE' && undefinedName) {
    humanTitle = `Variable '${undefinedName}' is not defined`;
  } else if (category === 'UNDEFINED_FUNCTION') {
    humanTitle = `Function '${undefinedName || 'unknown'}' is not defined`;
  } else if (category === 'UNDEFINED_FILTER') {
    humanTitle = `Filter '${undefinedName || 'unknown'}' is not defined`;
  } else if (category === 'IMPORT_ERROR') {
    humanTitle = 'Cannot import template - module not found';
  } else if (category === 'FILE_NOT_FOUND') {
    humanTitle = `Template file not found: ${undefinedName || 'unknown'}`;
  } else if (category === 'DICTSDICT_FILTER_BY') {
    humanTitle = plain;
  } else if (category === 'SYNTAX_ERROR') {
    humanTitle = 'Template syntax error';
  } else if (category === 'VALIDATION_ERROR') {
    humanTitle = 'Template must be a string';
  } else if (category === 'RESERVED_KEYWORD_CONTEXT') {
    humanTitle = plain;
  } else if (category === 'RESERVED_KEYWORD') {
    const match = plain.match(/Cannot use reserved (\w+) '([^']+)'/);
    if (match) {
      humanTitle = `Cannot use reserved ${match[1]} '${match[2]}'`;
    }
  }
  const location = toDisplayLocation(
    lineno ?? error?.lineno ?? null,
    colno ?? error?.colno ?? null,
    isJsCaller ? 'one' : (error?.lineBase ?? 'zero')
  );
  const displayLine = location.line;
  const displayCol = location.col;
  const displayPath = templatePath || 'unknown';

  let codeSnippet = snippet;
  let snippetErrorIndex = -1;
  let startLine = 0;
  let displayStartLine = 1;
  if (!codeSnippet && sourceContent) {
    const lines = sourceContent.split('\n');
    const relativeLine = sourceStartLine ? displayLine - sourceStartLine + 1 : displayLine;
    const clampedLine = Math.max(1, Math.min(relativeLine, lines.length));
    startLine = Math.max(0, clampedLine - 3);
    displayStartLine = sourceStartLine ? sourceStartLine + startLine : startLine + 1;
    const endLine = Math.min(lines.length, clampedLine + 2);
    codeSnippet = lines.slice(startLine, endLine).join('\n');
    snippetErrorIndex = clampedLine - startLine - 1;
  } else if (!codeSnippet && templatePath && /\.(js|njk|tmpl|tpl|html|htm)$/i.test(templatePath)) {
    try {
      let resolvedPath = templatePath;
      if (templatePath.startsWith('file://')) {
        resolvedPath = fileURLToPath(templatePath);
      } else if (/^[a-zA-Z]:[/\\]/.test(templatePath) || templatePath.startsWith('/')) {
        resolvedPath = templatePath.replace(/\//g, path.sep);
      } else {
        resolvedPath = path.resolve(templatePath);
      }
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      const clampedLine = Math.max(1, Math.min(displayLine, lines.length));
      startLine = Math.max(0, clampedLine - 3);
      displayStartLine = startLine + 1;
      const endLine = Math.min(lines.length, clampedLine + 2);
      codeSnippet = lines.slice(startLine, endLine).join('\n');
      snippetErrorIndex = clampedLine - startLine - 1;
    } catch {
    }
  }

  const badgeCode = category;
  const codeBadge = badgeCode
    ? `<span class="badge badge-error">${escapeHtml(badgeCode)}</span>`
    : '';
  const phaseBadge = phase
    ? `<span class="badge badge-code">${escapeHtml(phase)}</span>`
    : '';

  const ideMeta = getIdeMeta(ide);
  const ideLabel = `Open in ${ideMeta.label}`;

  const locDisplay = `${shortenPath(displayPath)}:${displayLine}:${displayCol}`;

  const headerTitle = escapeHtml(humanTitle);
  const locationInfo = escapeHtml(`${displayPath}:${displayLine}:${displayCol}`);

  const possibleCauses = classified?.causes || [];
  const fixCode = classified?.fixCode || '';
  const fixComment = classified?.fixComment || '';

  const body = `
<main class="error-wrapper" aria-labelledby="err-title">
  <header class="error-header">
    <div class="error-header-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Template Rendering Error
      ${codeBadge}${phaseBadge ? ' ' + phaseBadge : ''}
      ${verbosity === 'full' ? '<span class="badge badge-dev">DEV</span>' : ''}
    </div>
    <h1 id="err-title" class="error-title">${headerTitle}</h1>
    ${verbosity !== 'simple' ? `
    <p class="error-location">The error occurred in ${displayPath
      ? `<a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="loc-link error-location-link">${escapeHtml(locDisplay)}</a>`
      : `<span class="error-location-text">${locationInfo}</span>`
    }</p>
    ` : ''}
  </header>

  ${verbosity === 'full' ? `
  <div class="error-body">

    ${codeSnippet ? `
    <section class="source-section" aria-labelledby="h-source">
        <h2 id="h-source" class="text-label">Source Trace</h2>
      <div class="code-block">
        ${codeSnippet.split('\n').reduce<string[]>((acc, line, idx) => {
          const isError = idx === snippetErrorIndex;
          const lineNum = displayStartLine + idx;
          acc.push(`<div class="code-line ${isError ? 'is-error' : ''}"><span class="line-number">${lineNum}</span><span class="code-content">${highlightSource(line, displayPath)}</span></div>`);
          if (isError && displayCol > 0 && line) {
            const caret = calculateCaretPosition(line, displayCol);
            if (caret) {
              const spaces = ' '.repeat(caret.wordStart);
              acc.push(`<div class="code-line error-marker"><span class="line-number"></span><span class="code-content error-marker-content">${spaces}${caret.carets}</span></div>`);
            }
          }
          return acc;
        }, []).join('\n')}
      </div>
    </section>
    ` : ''}

    <div class="causes-grid">
      <section aria-labelledby="h-causes">
        <h2 id="h-causes" class="text-label">Possible Causes</h2>
        <ul class="causes-list">
          ${possibleCauses.length > 0
            ? possibleCauses.map(c => `<li>${renderMarkdownToAnsi(c)}</li>`).join('\n          ')
            : '<li>Check template syntax and context</li>'
          }
        </ul>
      </section>
      <section aria-labelledby="h-fix">
        <h2 id="h-fix" class="text-label">Suggested Fix</h2>
        <pre class="fix-block"><code>${fixComment ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n` : ''}${fixCode ? highlightHtml(fixCode) : '// No fix available'}</code></pre>
      </section>
    </div>

    ${renderContext ? renderContextHtml(renderContext) : ''}

    ${error.stack ? formatStackTraceHtml(error, false, ide) : ''}
  </div>
  ` : ''}

  <footer class="error-footer">
    <p class="meta">
      Nunjucks ${version}${timestamp ? ` · ${escapeHtml(timestamp)}` : ''}
    </p>
    ${verbosity === 'full' ? `
    <div class="error-footer-actions">
      <a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="btn btn-solid">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${ideMeta.icon}</svg>
        ${ideLabel}
      </a>
    </div>
    ` : ''}
  </footer>
</main>`;

  return document('Template Error', body, TOGGLE_SCRIPT, csp ?? null);
};

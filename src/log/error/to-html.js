import { classify } from './classify.js';
import { toText } from './to-text.js';
import { escapeHtml, highlightHtml } from './formatters/html/highlight.js';
import { renderContextHtml, formatStackTraceHtml } from './formatters/html/sections.js';
import { CSS, PRODUCTION_BODY } from './formatters/html/styles.js';
import { TOGGLE_SCRIPT } from './formatters/html/script.js';
import { resolveIdeLink, getIdeMeta } from './constants/ide-links.js';
import { shortenPath } from '../../shared/path-shortener.js';

export { CSS, PRODUCTION_BODY, TOGGLE_SCRIPT };

const document = (title, body, scripts = '', csp = null) => {
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

const buildProductionBody = (options) => {
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

const renderMarkdownToAnsi = (text) => {
  if (!text) return '';
  let s = text;
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
};

/**
 * Render error to HTML output
 * @param {Error} error - Raw error from nunjucks
 * @param {object} options - Optional configuration
 * @returns {string} HTML string
 */
export const toHtml = (error, options = {}) => {
  const {
    templatePath,
    lineno,
    colno,
    renderContext,
    phase,
    version = '3.2.4',
    timestamp,
    csp,
    jsCaller,
    jsCallerErrorLine,
    sourceContent,
    snippet,
    ide = 'vscode',
    verbosity = 'full'
  } = options;

  if (!error) {
    return document('Error', buildProductionBody(options), '', csp);
  }

  if (options.isProduction) {
    return document('Rendering Interrupted', buildProductionBody(options), '', csp);
  }

  const classified = classify(error);
  const plain = toText(error, { verbosity: 'simple' });

  const category = error.code || classified?.category?.toUpperCase() || 'UNKNOWN';
  const displayLine = (lineno ?? error?.lineno ?? 0) + 1;
  const displayCol = (colno ?? error?.colno ?? 0) + 1;
  const displayPath = templatePath || 'unknown';

  // Generate snippet from sourceContent if not provided
  let codeSnippet = snippet;
  let snippetErrorIndex = -1;
  let startLine = 0;
  if (!codeSnippet && sourceContent) {
    const lines = sourceContent.split('\n');
    startLine = Math.max(0, displayLine - 3);
    const endLine = Math.min(lines.length, displayLine + 2);
    codeSnippet = lines.slice(startLine, endLine).join('\n');
    snippetErrorIndex = displayLine - startLine - 1;
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

  const headerTitle = escapeHtml(plain);
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
        ${codeSnippet.split('\n').map((line, idx) => {
          const isError = idx === snippetErrorIndex;
          const lineNum = startLine + idx + 1;
          return `<div class="code-line ${isError ? 'is-error' : ''}"><span class="line-number">${lineNum}</span><span class="code-content">${highlightHtml(line)}</span></div>`;
        }).join('\n')}
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

  return document('Template Error', body, TOGGLE_SCRIPT, csp);
};

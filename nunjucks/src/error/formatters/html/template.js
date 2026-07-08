import { formatLocation, getDisplayMessage } from '../../state/display.js';
import { escapeHtml, renderInlineMarkdown, highlightHtml, highlightJs } from './highlight.js';
import { formatCodeTraceHtml, renderContextHtml, formatStackTraceHtml } from './sections.js';
import { CSS, PRODUCTION_BODY } from './styles.js';
import { resolveIdeLink, getIdeMeta } from '../../constants/ide-links.js';

const shortenPath = (path, maxLen = 60) => {
  if (path.length <= maxLen) return path;
  const parts = path.split(/[\\/]/);
  const filename = parts[parts.length - 1];
  const firstDir = parts.slice(0, 2).join('\\');
  return `${firstDir}\\...\\${filename}`;
};

const document = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>
body{margin:0;min-block-size:100dvh;padding:1rem;background:var(--color-bg-page);color:var(--color-text-primary);font-family:system-ui,-apple-system,sans-serif}
${CSS}
</style>
</head>
<body>
${body}
</body>
</html>`;

export const toHtmlString = (state) => {
  const {
    errorId,
    timestamp,
    code,
    phase,
    templatePath,
    snippet,
    classified,
    getDisplayLine,
    getDisplayCol,
    isProduction,
    originalError,
    renderContext
  } = state;

  if (isProduction) {
    return document('Rendering Interrupted', PRODUCTION_BODY);
  }

  const headerTitle = escapeHtml(getDisplayMessage(state));
  const locationInfo = escapeHtml(formatLocation(state));
  const possibleCauses = classified.causes;
  const fixCode = classified.fixCode;
  const fixComment = classified.fixComment;
  const codeBadge = code
    ? `<span class="badge badge-error">${escapeHtml(code)}</span>`
    : '';
  const phaseBadge = phase
    ? `<span class="badge badge-code">${escapeHtml(phase)}</span>`
    : '';
  const ideMeta = getIdeMeta(state.ide || 'vscode');
  const ideLabel = `Open in ${ideMeta.label}`;
  const locDisplay = templatePath
    ? shortenPath(escapeHtml(templatePath) + ':' + getDisplayLine() + ':' + getDisplayCol())
    : locationInfo;

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
      ${codeBadge}${phaseBadge}
    </div>
    <h1 id="err-title" class="error-title">${headerTitle}</h1>
    <p class="error-location">The error occurred in ${templatePath
      ? `<a href="${resolveIdeLink(state.ide, escapeHtml(templatePath), getDisplayLine(), getDisplayCol())}" class="loc-link" style="font-weight:600;color:var(--color-text-primary);">${locDisplay}</a>`
      : `<span style="font-weight:600;color:var(--color-text-primary);">${locDisplay}</span>`
    }</p>
  </header>

  <div class="error-body">
    <section aria-labelledby="h-source" style="margin-block-end: 2rem;">
      <h2 id="h-source" class="text-label">Source Trace</h2>
      <div class="code-block" role="group" aria-label="Template source around the error">
        ${formatCodeTraceHtml(snippet)}
      </div>
    </section>

    <div class="causes-grid">
      <section aria-labelledby="h-causes">
        <h2 id="h-causes" class="text-label">Possible Causes</h2>
        <ul class="causes-list">
          ${possibleCauses.map(c => `<li>${renderInlineMarkdown(c)}</li>`).join('\n          ')}
        </ul>
      </section>
      <section aria-labelledby="h-fix">
        <h2 id="h-fix" class="text-label">Suggested Fix</h2>
        <pre class="fix-block"><code>${fixComment ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n` : ''}${/\{\{|{%|{#/.test(fixCode) ? highlightHtml(fixCode) : highlightJs(fixCode)}</code></pre>
      </section>
    </div>

    ${renderContextHtml(renderContext)}

    ${formatStackTraceHtml(originalError, isProduction, state.ide)}
  </div>

  <footer class="error-footer">
    <p class="meta">
      ${errorId ? `ID: ${escapeHtml(errorId)}<br>\n      ` : ''}${timestamp ? `${escapeHtml(timestamp)} · ` : ''}Environment: <span style="font-weight:600;color:var(--color-text-primary);">${isProduction ? 'Production' : 'Development'}</span>
    </p>
    <a href="${templatePath ? resolveIdeLink(state.ide, escapeHtml(templatePath), getDisplayLine(), getDisplayCol()) : '#'}" class="btn btn-solid" ${!templatePath ? 'aria-disabled="true" style="opacity:0.5;pointer-events:none;"' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ideMeta.icon}</svg>
      ${ideLabel}
    </a>
  </footer>
</main>`;

  return document(`Error: ${getDisplayMessage(state)}`, body);
};

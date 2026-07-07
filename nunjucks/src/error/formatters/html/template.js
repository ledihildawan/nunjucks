import { formatLocation, getDisplayMessage } from '../../state/display.js';
import { escapeHtml, renderInlineMarkdown, highlightHtml } from './highlight.js';
import { formatCodeTraceHtml, renderContextHtml, formatStackTraceHtml } from './sections.js';
import { CSS, CSS_VARS, PRODUCTION_BODY } from './styles.js';

const document = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>
body{margin:0;background:var(--color-bg-page);color:var(--color-text-primary);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif}
${CSS_VARS}
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
    ? `<span style="margin-left:8px;padding:2px 8px;border-radius:4px;background:var(--color-error-bg);color:var(--color-error-text);font-size:10px;letter-spacing:0.05em;">${escapeHtml(code)}</span>`
    : '';
  const phaseBadge = phase
    ? `<span style="margin-left:4px;padding:2px 8px;border-radius:4px;background:var(--color-code-highlight-bg);color:var(--color-code-text);font-size:10px;text-transform:lowercase;">${escapeHtml(phase)}</span>`
    : '';
  const metaBits = [];
  if (errorId) metaBits.push(`ID: ${escapeHtml(errorId)}`);
  if (timestamp) metaBits.push(escapeHtml(timestamp));
  const metaStrip = metaBits.length ? `${metaBits.join(' · ')} · ` : '';

  const body = `
<section class="error-wrapper" aria-labelledby="err-title">
  <header class="error-header">
    <p class="error-header-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Template Rendering Error
      ${codeBadge}${phaseBadge}
    </p>
    <h1 id="err-title" class="error-title">${headerTitle}</h1>
    <p class="error-location">The error occurred in ${templatePath
      ? `<a href="vscode://file/${escapeHtml(templatePath)}:${getDisplayLine()}:${getDisplayCol()}" class="loc-link" style="font-weight:600;color:var(--color-text-primary);">${locationInfo}</a>`
      : `<span style="font-weight:600;color:var(--color-text-primary);">${locationInfo}</span>`
    }</p>
  </header>

  <div style="padding: 32px;">
    <section aria-labelledby="h-source" style="margin-bottom: 32px;">
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
        <pre class="fix-block"><code>${fixComment ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n` : ''}${highlightHtml(fixCode)}</code></pre>
      </section>
    </div>

    ${renderContextHtml(renderContext)}

    ${formatStackTraceHtml(originalError, isProduction)}
  </div>

  <footer class="error-footer">
    <p class="meta">
      ${metaStrip}Environment: <span style="font-weight:600;color:var(--color-text-primary);">${isProduction ? 'Production' : 'Development'}</span>
    </p>
    <a href="${templatePath ? 'vscode://file/' + escapeHtml(templatePath) + ':' + getDisplayLine() + ':' + getDisplayCol() : '#'}" class="btn btn-solid" ${!templatePath ? 'aria-disabled="true" style="opacity:0.5;pointer-events:none;"' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path>
        <path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"></path>
        <path d="M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"></path>
        <rect x="15" y="6" width="6" height="12" rx="2"></rect>
      </svg>
      Open in IDE
    </a>
  </footer>
</section>`;

  return document(`Error: ${getDisplayMessage(state)}`, body);
};

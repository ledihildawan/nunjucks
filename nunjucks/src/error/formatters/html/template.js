import { formatLocation, getDisplayMessage } from '../../state/display.js';
import { escapeHtml, renderInlineMarkdown, highlightHtml, highlightJs } from './highlight.js';
import { formatCodeTraceHtml, renderContextHtml, formatStackTraceHtml } from './sections.js';
import { CSS } from './styles.js';
import { resolveIdeLink, getIdeMeta } from '../../constants/ide-links.js';

const shortenPath = (path, maxLen = 60) => {
  if (path.length <= maxLen) return path;
  const parts = path.split(/[\\/]/);
  const filename = parts[parts.length - 1];
  const firstDir = parts.slice(0, 2).join('\\');
  return `${firstDir}\\...\\${filename}`;
};

const TOGGLE_SCRIPT = `
<script>
function toggleStack(){const e=document.getElementById("stack-container"),t=e.querySelectorAll(".stack-row"),n=document.getElementById("btn-toggle-stack"),o=e.classList.contains("is-expanded");e.classList.toggle("is-expanded"),t.forEach((e,t)=>{t>=5&&(o?e.classList.add("is-collapsed"):e.classList.remove("is-collapsed"))}),o?n.textContent="Show "+(t.length-5)+" more lines...":n.textContent="Collapse stack trace"}
</script>`;

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
${TOGGLE_SCRIPT}
</body>
</html>`;

const buildProductionBody = (state) => {
  const ref = state.fingerprint ? `<p style="font-size:0.75rem;color:var(--color-text-secondary);margin:0;opacity:0.7;">Ref: #${escapeHtml(state.fingerprint)}${state.timestamp ? ' · ' + escapeHtml(state.timestamp) : ''}</p>` : '';
  return `
<main style="font-family:system-ui,-apple-system,sans-serif;max-width:32.5rem;margin:3rem auto;padding:2rem;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:0.75rem;box-shadow:0 1.5rem 3rem -0.75rem rgba(0,0,0,0.15);text-align:center;">
  <div style="margin-bottom:1.25rem;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-error-border)" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-text-primary);margin:0 0 0.5rem;">Rendering Interrupted</h1>
  <p style="font-size:0.875rem;color:var(--color-text-secondary);margin:0 0 0.25rem;">An error occurred during template rendering.</p>
  <p style="font-size:0.75rem;color:var(--color-text-secondary);margin:0 0 1.25rem;opacity:0.8;">500 · Internal Server Error</p>
  <a href="" style="display:inline-block;padding:0.6em 1.5em;border-radius:0.375rem;font-size:0.8125rem;font-weight:600;text-decoration:none;background:var(--color-btn-bg);color:var(--color-btn-text);margin-bottom:1.25rem;">Try Again</a>
  ${ref}
</main>`;
};

export const toHtmlString = (state) => {
  const {
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
    return document('Rendering Interrupted', buildProductionBody(state));
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
      <span class="badge badge-code" style="margin-inline-start:auto;border:1px solid var(--color-border);">DEV</span>
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
      Nunjucks ${state.version || '3.2.4'}${state.fingerprint ? ` · #${escapeHtml(state.fingerprint)}` : ''}${state.timestamp ? ` · ${escapeHtml(state.timestamp)}` : ''}
    </p>
    <div style="display:flex;align-items:center;">
      <a href="${templatePath ? resolveIdeLink(state.ide, escapeHtml(templatePath), getDisplayLine(), getDisplayCol()) : '#'}" class="btn btn-solid" ${!templatePath ? 'aria-disabled="true" style="opacity:0.5;pointer-events:none;"' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ideMeta.icon}</svg>
        ${ideLabel}
      </a>
    </div>
  </footer>
</main>`;

  return document(`Error: ${getDisplayMessage(state)}`, body);
};

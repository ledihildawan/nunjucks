import { escapeHtml, highlightHtml, renderInlineMarkdown } from './internal/highlight/highlight.ts';
import { join, map, pipe } from 'remeda';
import { renderContextHtml, formatStackTraceHtml } from './internal/formatting/sections.ts';
import { resolveIdeLink, getIdeMeta } from './internal/config/ide-links.ts';
import type { SourceTrace } from './internal/location/source-trace.ts';
import type { ErrorLike } from './to-html-types.ts';
import { renderBadge, highlightSource, SEVERITY_HEADINGS, type classifyError } from './to-html-display.ts';

const renderSourceTraceSection = (sourceTrace: SourceTrace | null | undefined, displayPath: string): string => {
  if (!sourceTrace || sourceTrace.lines.length === 0) { return ''; }

  const rows = sourceTrace.lines.flatMap(line => {
    const errorClass = line.isError ? 'is-error' : '';
    const row = `<div class="code-line ${errorClass}"><span class="line-number">${line.number}</span><span class="code-content">${highlightSource(line.content, displayPath)}</span></div>`;
    if (line.isError && sourceTrace.caret) {
      const spaces = ' '.repeat(sourceTrace.caret.charStart);
      return [row, `<div class="code-line error-marker"><span class="line-number"></span><span class="code-content error-marker-content">${spaces}${sourceTrace.caret.carets}</span></div>`];
    }
    return [row];
  });

  return `
    <section class="source-section" aria-labelledby="h-source">
        <h2 id="h-source" class="text-label">Source Trace</h2>
      <div class="code-block">
        ${rows.join('\n')}
      </div>
    </section>
    `;
};

const buildErrorHeader = (
  humanTitle: string,
  category: string,
  severity: 'error' | 'warning' | 'info',
  phase: string | null | undefined,
  verbosity: 'simple' | 'medium' | 'full',
  displayPath: string,
  displayLine: number,
  displayCol: number,
  ide: string,
  canLinkLocation: boolean,
  locDisplay: string
): string => {
  const codeBadge = renderBadge('badge-error', category);
  const phaseBadge = renderBadge('badge-code', phase);
  const headerTitle = escapeHtml(humanTitle);
  const severityText = SEVERITY_HEADINGS[severity] ?? SEVERITY_HEADINGS.error;
  const phaseBadgePart = phaseBadge ? ` ${phaseBadge}` : '';
  const devBadge = verbosity === 'full' ? '<span class="badge badge-dev">DEV</span>' : '';

  const locationLink = canLinkLocation
    ? `<a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="loc-link error-location-link">${escapeHtml(locDisplay)}</a>`
    : `<span class="error-location-text">${escapeHtml(locDisplay)}</span>`;
  const errorLocationBlock = verbosity !== 'simple'
    ? `<p class="error-location">The error occurred in ${locationLink}</p>`
    : '';

  return `
  <header class="error-header">
    <div class="error-header-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      ${severityText}
      ${codeBadge}${phaseBadgePart}
      ${devBadge}
    </div>
    <h1 id="err-title" class="error-title">${headerTitle}</h1>
    ${errorLocationBlock}
  </header>`;
};

const buildFullErrorBody = (
  sourceTrace: SourceTrace | null | undefined,
  possibleCauses: string[],
  fixCode: string,
  fixComment: string,
  documentationUrl: string | null,
  renderContext: object | undefined,
  error: ErrorLike,
  ide: string,
  displayPath: string
): string => {
  const codeSection = renderSourceTraceSection(sourceTrace, displayPath);
  const possibleCausesList = possibleCauses.length > 0
    ? pipe(possibleCauses, map(c => `<li>${renderInlineMarkdown(c)}</li>`), join('\n          '))
    : '<li>Check template syntax and context</li>';
  const fixCommentSpan = fixComment ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n` : '';
  const fixCodeBlock = fixCode ? highlightHtml(fixCode) : '// No fix available';
  const docsLink = documentationUrl
    ? `\n<span class="docs-inline">Learn more: <a href="${escapeHtml(documentationUrl)}" target="_blank" rel="noopener" class="docs-link">${escapeHtml(documentationUrl)}</a></span>`
    : '';
  const renderContextSection = renderContext ? renderContextHtml(renderContext, error.blockedKeys) : '';
  const stackTraceSection = error.stack ? formatStackTraceHtml(error, false, ide) : '';

  return `
  <div class="error-body">
    ${codeSection}
    <div class="causes-grid">
      <section aria-labelledby="h-causes">
        <h2 id="h-causes" class="text-label">Possible Causes</h2>
        <ul class="causes-list">
          ${possibleCausesList}
        </ul>
      </section>
      <section aria-labelledby="h-fix">
        <h2 id="h-fix" class="text-label">Suggested Fix</h2>
        <pre class="fix-block"><code>${fixCommentSpan}${fixCodeBlock}${docsLink}</code></pre>
      </section>
    </div>
    ${renderContextSection}
    ${stackTraceSection}
  </div>`;
};

const buildErrorFooter = (
  version: string,
  timestamp: string | undefined,
  verbosity: 'simple' | 'medium' | 'full',
  canLinkLocation: boolean,
  ide: string,
  displayPath: string,
  displayLine: number,
  displayCol: number
): string => {
  const timestampPart = timestamp ? ` · ${escapeHtml(timestamp)}` : '';
  const footerActions = verbosity === 'full' && canLinkLocation
    ? (() => {
      const ideMeta = getIdeMeta(ide);
      const ideLabel = `Open in ${ideMeta.label}`;
      return `
    <div class="error-footer-actions">
      <a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="btn btn-solid">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${ideMeta.icon}</svg>
        ${ideLabel}
      </a>
    </div>`;
    })()
    : '';
  return `
  <footer class="error-footer">
    <p class="meta">
      Nunjucks ${version}${timestampPart}
    </p>
    ${footerActions}
  </footer>`;
};

const buildErrorBodyContent = (
  verbosity: string,
  error: ErrorLike,
  classified: ReturnType<typeof classifyError>,
  sourceTrace: SourceTrace | null | undefined,
  renderContext: unknown,
  ide: string,
  displayPath: string
): string => {
  if (verbosity !== 'full') { return ''; }
  return buildFullErrorBody(
    sourceTrace,
    classified.causes,
    classified.fixCode,
    classified.fixComment,
    classified.documentationUrl,
    renderContext as object | undefined,
    error,
    ide,
    displayPath
  );
};

const buildHtmlWrapper = (header: string, errorBody: string, footer: string): string => `
<main class="error-wrapper" aria-labelledby="err-title">
  ${header}
  ${errorBody}
  ${footer}
</main>`;

export { buildErrorHeader, buildErrorFooter, buildErrorBodyContent, buildHtmlWrapper };

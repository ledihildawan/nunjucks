import { titleCase } from '@nunjucks/lib';
import { join, map, pipe } from 'remeda';
import { formatStackTraceHtml, renderContextHtml } from './presentation/error/sections.ts';
import { getIdeMeta, resolveIdeLink } from './presentation/ide-links/ide-links.ts';
import type { SourceTrace } from './presentation/source-trace/source-trace.ts';
import {
  escapeAttribute,
  escapeHtml,
  highlightHtml,
  renderInlineMarkdown,
} from './presentation/syntax-highlight/highlight.ts';
import { renderBadge } from './to-html-display.ts';
import type { ClassifiedError, ErrorLike } from './to-html-types.ts';

const renderSourceTraceSection = (sourceTrace: SourceTrace | null | undefined): string => {
  if (!sourceTrace || sourceTrace.lines.length === 0) {
    return '';
  }

  const rows = sourceTrace.lines.flatMap((line) => {
    const errorClass = line.isError ? 'is-error' : '';
    const row = `<div class="code-line ${errorClass}"><span class="line-number">${line.number}</span><span class="code-content">${highlightHtml(line.content)}</span></div>`;
    if (line.isError && sourceTrace.caret) {
      const spaces = ' '.repeat(sourceTrace.caret.charStart);
      return [
        row,
        `<div class="code-line error-marker"><span class="line-number"></span><span class="code-content error-marker-content">${spaces}${escapeHtml(sourceTrace.caret.carets)}</span></div>`,
      ];
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

interface ErrorHeaderInput {
  humanTitle: string;
  category: string;
  phase: string | null | undefined;
  environment: string | null;
  verbosity: 'simple' | 'medium' | 'full';
  displayPath: string;
  displayLine: number;
  displayCol: number;
  ide: string;
  canLinkLocation: boolean;
  locDisplay: string;
}

const buildErrorHeader = ({
  humanTitle,
  category,
  phase,
  environment,
  verbosity,
  displayPath,
  displayLine,
  displayCol,
  ide,
  canLinkLocation,
  locDisplay,
}: ErrorHeaderInput): string => {
  const phaseText = phase ? titleCase(phase) : null;
  const phaseBadge = renderBadge('badge-code', phaseText);
  const envBadge = environment
    ? `<span class="badge badge-dev" style="margin-inline-start:auto;text-transform:none">${escapeHtml(titleCase(environment))}</span>`
    : '';
  const headerTitle = escapeHtml(humanTitle);
  const phaseBadgePart = phaseBadge ? ` ${phaseBadge}` : '';

  const locationLink = canLinkLocation
    ? `<a href="${escapeAttribute(resolveIdeLink(ide, { path: displayPath, line: displayLine, col: displayCol }))}" class="loc-link error-location-link">${escapeHtml(locDisplay)}</a>`
    : `<span class="error-location-text">${escapeHtml(locDisplay)}</span>`;
  const errorLocationBlock =
    verbosity !== 'simple'
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
      ${escapeHtml(category)}${phaseBadgePart}${envBadge}
    </div>
    <h1 id="err-title" class="error-title">${headerTitle}</h1>
    ${errorLocationBlock}
  </header>`;
};

interface FullErrorBodyInput {
  sourceTrace: SourceTrace | null | undefined;
  possibleCauses: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  renderContext: Record<string, unknown> | undefined;
  error: ErrorLike;
  ide: string;
}

const buildFullErrorBody = ({
  sourceTrace,
  possibleCauses,
  fixCode,
  fixComment,
  documentationUrl,
  renderContext,
  error,
  ide,
}: FullErrorBodyInput): string => {
  const codeSection = renderSourceTraceSection(sourceTrace);
  const possibleCausesList =
    possibleCauses.length > 0
      ? pipe(
          possibleCauses,
          map((c) => `<li>${renderInlineMarkdown(c)}</li>`),
          join('\n          ')
        )
      : '<li>Check template syntax and context</li>';
  const fixCommentSpan = fixComment
    ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n`
    : '';
  const fixCodeBlock = fixCode ? highlightHtml(fixCode) : '// No fix available';
  const docsLink = documentationUrl
    ? `\n<span class="docs-inline">Learn more: <a href="${escapeHtml(documentationUrl)}" target="_blank" rel="noopener" class="docs-link">${escapeHtml(documentationUrl)}</a></span>`
    : '';
  const renderContextSection = renderContext
    ? renderContextHtml(renderContext, error.blockedKeys)
    : '';
  const stackTraceSection = error.stack
    ? formatStackTraceHtml({ originalError: error, isProduction: false, ide })
    : '';

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

interface ErrorFooterInput {
  version: string;
  timestamp: string | null | undefined;
  verbosity: 'simple' | 'medium' | 'full';
  canLinkLocation: boolean;
  ide: string;
  displayPath: string;
  displayLine: number;
  displayCol: number;
}

const buildErrorFooter = ({
  version,
  timestamp,
  verbosity,
  canLinkLocation,
  ide,
  displayPath,
  displayLine,
  displayCol,
}: ErrorFooterInput): string => {
  const timestampPart = timestamp ? ` · ${escapeHtml(timestamp)}` : '';
  const versionPart = version ? ` Nunjucks ${escapeHtml(version)}` : '';
  const footerActions =
    verbosity === 'full' && canLinkLocation
      ? (() => {
          const ideMeta = getIdeMeta(ide);
          const ideLabel = `Open in ${ideMeta.label}`;
          return `
    <div class="error-footer-actions">
      <a href="${escapeAttribute(resolveIdeLink(ide, { path: displayPath, line: displayLine, col: displayCol }))}" class="btn btn-solid">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${ideMeta.icon}</svg>
        ${ideLabel}
      </a>
    </div>`;
        })()
      : '';
  return `
  <footer class="error-footer">
    <p class="meta">
      ${versionPart}${timestampPart}
    </p>
    ${footerActions}
  </footer>`;
};

interface ErrorBodyContentInput {
  verbosity: string;
  error: ErrorLike;
  classified: ClassifiedError;
  sourceTrace: SourceTrace | null | undefined;
  renderContext: Record<string, unknown> | undefined;
  ide: string;
}

const buildErrorBodyContent = ({
  verbosity,
  error,
  classified,
  sourceTrace,
  renderContext,
  ide,
}: ErrorBodyContentInput): string => {
  if (verbosity !== 'full') {
    return '';
  }
  return buildFullErrorBody({
    sourceTrace,
    possibleCauses: classified.causes,
    fixCode: classified.fixCode,
    fixComment: classified.fixComment,
    documentationUrl: classified.documentationUrl,
    renderContext,
    error,
    ide,
  });
};

interface BuildHtmlWrapperOptions {
  header: string;
  errorBody: string;
  footer: string;
}

const buildHtmlWrapper = ({ header, errorBody, footer }: BuildHtmlWrapperOptions): string => `
<main class="error-wrapper" aria-labelledby="err-title">
  ${header}
  ${errorBody}
  ${footer}
</main>`;

export { buildErrorBodyContent, buildErrorFooter, buildErrorHeader, buildHtmlWrapper };

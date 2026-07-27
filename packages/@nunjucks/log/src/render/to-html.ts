import { classifyFromError } from '../errors/classify.ts';
import { toText } from './to-text.ts';
import { escapeHtml, highlightHtml, highlightJs } from './internal/highlight.ts';
import { renderContextHtml, formatStackTraceHtml } from './internal/sections.ts';
import { CSS, } from './internal/styles.ts';
import { TOGGLE_SCRIPT } from './internal/script.ts';
import { isFilePath, resolveIdeLink, getIdeMeta } from './internal/ide-links.ts';
import { toDisplayLocation } from './internal/location.ts';
import type { SourceTrace } from './internal/source-trace.ts';
import { shortenPath } from './internal/path-shortener.ts';

interface Csp {
  nonce?: string;
}

const document = (title: string, body: string, scripts = '', csp: Csp | null = null): string => {
  let styleNonce = '';
  if (csp?.nonce) {
    styleNonce = ` nonce="${csp.nonce}"`;
  }
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
  let ref = '';
  if (options.timestamp) {
    ref = `<p class="prod-ref">${escapeHtml(options.timestamp)}</p>`;
  }
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
  if (!text) { return ''; }
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/gu, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>');
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

interface ToHtmlOptions {
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
  sourceTrace?: SourceTrace | null;
  ide?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isJsCaller?: boolean;
  isProduction?: boolean;
}

const SCRIPT_EXTENSION_RE = /\.(?:[cm]?[jt]sx?|mjs|cjs)$/iu;
const UNDEFINED_OUTPUT_RE = /attempted to output '([^']+)'/u;
const RESERVED_KEYWORD_RE = /Cannot use reserved (\w+) '([^']+)'/u;

const isScriptPath = (filePath?: string | null): boolean =>
  SCRIPT_EXTENSION_RE.test(filePath || '');

const SEVERITY_HEADINGS: Record<string, string> = {
  warning: 'Template Warning',
  info: 'Template Info',
  error: 'Template Rendering Error',
};

/** A pill badge, or '' when there is nothing to show. */
const renderBadge = (variant: string, text?: string | null): string => {
  if (!text) { return ''; }
  return `<span class="badge ${variant}">${escapeHtml(text)}</span>`;
};

/**
 * The windowed source lines plus the caret row, or '' when there is no trace.
 * The trace itself is built upstream by buildSourceTrace; this only presents it.
 */
const renderSourceTraceSection = (sourceTrace: SourceTrace | null | undefined, displayPath: string): string => {
  if (!sourceTrace || sourceTrace.lines.length === 0) { return ''; }

  const rows: string[] = [];
  for (const line of sourceTrace.lines) {
    let errorClass = '';
    if (line.isError) { errorClass = 'is-error'; }
    rows.push(`<div class="code-line ${errorClass}"><span class="line-number">${line.number}</span><span class="code-content">${highlightSource(line.content, displayPath)}</span></div>`);
    if (line.isError && sourceTrace.caret) {
      const spaces = ' '.repeat(sourceTrace.caret.charStart);
      rows.push(`<div class="code-line error-marker"><span class="line-number"></span><span class="code-content error-marker-content">${spaces}${sourceTrace.caret.carets}</span></div>`);
    }
  }

  return `
    <section class="source-section" aria-labelledby="h-source">
        <h2 id="h-source" class="text-label">Source Trace</h2>
      <div class="code-block">
        ${rows.join('\n')}
      </div>
    </section>
    `;
};

interface HumanTitleInput {
  category: string;
  undefinedName: string | null;
  /** The plain-text rendering of the error, used verbatim by some categories. */
  plain: string;
  /** Used when the category has no dedicated phrasing. */
  fallback: string;
}

/**
 * The headline shown at the top of the error page. Each category that has a
 * better phrasing than the raw message gets one; everything else falls back.
 */
const resolveHumanTitle = ({ category, undefinedName, plain, fallback }: HumanTitleInput): string => {
  const named = undefinedName || 'unknown';

  switch (category) {
    case 'UNDEFINED_VARIABLE':
      if (!undefinedName) { return fallback; }
      return `Variable '${undefinedName}' is not defined`;
    case 'UNDEFINED_FUNCTION':
      return `Function '${named}' is not defined`;
    case 'UNDEFINED_FILTER':
      return `Filter '${named}' is not defined`;
    case 'IMPORT_ERROR':
      return 'Cannot import template - module not found';
    case 'FILE_NOT_FOUND':
      return `Template file not found: ${named}`;
    case 'SYNTAX_ERROR':
      return 'Template syntax error';
    case 'VALIDATION_ERROR':
      return 'Template must be a string';
    case 'DICTSDICT_FILTER_BY':
    case 'RESERVED_KEYWORD_CONTEXT':
      return plain;
    case 'RESERVED_KEYWORD': {
      const match = plain.match(RESERVED_KEYWORD_RE);
      if (!match) { return fallback; }
      return `Cannot use reserved ${match[1]} '${match[2]}'`;
    }
    default:
      return fallback;
  }
};

const highlightSource = (code: string, filePath?: string | null): string => {
  if (isScriptPath(filePath)) {
    return highlightJs(code);
  }
  return highlightHtml(code);
};

interface ClassifiedError {
  category: string;
  undefinedName: string | null;
  title: string;
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: 'error' | 'warning' | 'info';
}

const classifyError = (error: ErrorLike): ClassifiedError => {
  const errWithExtras = error as {
    code?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  const classified = classifyFromError(errWithExtras);
  const possibleCauses = classified.causes && classified.causes.length > 0
    ? [...classified.causes]
    : [...(errWithExtras.causes || [])];
  return {
    category: error.code || classified.category.toUpperCase() || 'UNKNOWN',
    undefinedName: classified.undefinedName || null,
    title: classified.title || '',
    causes: possibleCauses,
    fixCode: classified.fixCode ?? errWithExtras.fixCode ?? '',
    fixComment: classified.fixComment ?? errWithExtras.fixComment ?? '',
    documentationUrl: classified.documentationUrl ?? errWithExtras.documentationUrl ?? null,
    severity: classified.severity,
  };
};

interface LocationInfo {
  displayLine: number;
  displayCol: number;
  displayPath: string;
  lineBaseValue: 'one' | 'zero';
}

const resolveErrorLocation = (
  error: ErrorLike | null,
  lineno: number | null | undefined,
  colno: number | null | undefined,
  templatePath: string | undefined,
  isJsCaller: boolean
): LocationInfo => {
  const lineBaseValue: 'one' | 'zero' = isJsCaller ? 'one' : (error?.lineBase ?? 'zero');
  const location = toDisplayLocation(
    lineno ?? error?.lineno ?? null,
    colno ?? error?.colno ?? null,
    lineBaseValue
  );
  return {
    displayLine: location.line,
    displayCol: location.col,
    displayPath: templatePath || 'unknown',
    lineBaseValue,
  };
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
  const ideMeta = getIdeMeta(ide);
  const _ideLabel = `Open in ${ideMeta.label}`;
  const headerTitle = escapeHtml(humanTitle);
  const locationInfo = escapeHtml(`${displayPath}:${displayLine}:${displayCol}`);
  const severityText = SEVERITY_HEADINGS[severity] ?? SEVERITY_HEADINGS.error;
  const phaseBadgePart = phaseBadge ? ` ${phaseBadge}` : '';
  const devBadge = verbosity === 'full' ? '<span class="badge badge-dev">DEV</span>' : '';

  let errorLocationBlock = '';
  if (verbosity !== 'simple') {
    const locationLink = canLinkLocation
      ? `<a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="loc-link error-location-link">${escapeHtml(locDisplay)}</a>`
      : `<span class="error-location-text">${locationInfo}</span>`;
    errorLocationBlock = `<p class="error-location">The error occurred in ${locationLink}</p>`;
  }

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
    ? possibleCauses.map(c => `<li>${renderMarkdownToAnsi(c)}</li>`).join('\n          ')
    : '<li>Check template syntax and context</li>';
  const fixCommentSpan = fixComment ? `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n` : '';
  const fixCodeBlock = fixCode ? highlightHtml(fixCode) : '// No fix available';
  const docsLink = documentationUrl
    ? `\n<span class="docs-inline">Learn more: <a href="${escapeHtml(documentationUrl)}" target="_blank" rel="noopener noreferrer" class="docs-link">${escapeHtml(documentationUrl)}</a></span>`
    : '';
  const renderContextSection = renderContext ? renderContextHtml(renderContext) : '';
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
  let footerActions = '';
  if (verbosity === 'full' && canLinkLocation) {
    const ideMeta = getIdeMeta(ide);
  const _ideLabel = `Open in ${ideMeta.label}`;
    footerActions = `
    <div class="error-footer-actions">
      <a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="btn btn-solid">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${ideMeta.icon}</svg>
        ${_ideLabel}
      </a>
    </div>`;
  }
  return `
  <footer class="error-footer">
    <p class="meta">
      Nunjucks ${version}${timestampPart}
    </p>
    ${footerActions}
  </footer>`;
};

const classifyAndBuildTitle = (error: ErrorLike) => {
  const classified = classifyError(error);
  const plain = toText(error, { verbosity: 'simple' });
  const undefinedName = classified.undefinedName || plain.match(UNDEFINED_OUTPUT_RE)?.[1] || null;
  return resolveHumanTitle({
    category: classified.category,
    undefinedName,
    plain,
    fallback: classified.title || plain
  });
};

const buildErrorBodyContent = (
  verbosity: string,
  error: ErrorLike,
  classified: ReturnType<typeof classifyError>,
  sourceTrace: unknown,
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
    renderContext,
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

const toHtml = (error: ErrorLike | null, options: ToHtmlOptions = {}): string => {
  const {
    templatePath = error?.templateName,
    lineno,
    colno,
    renderContext,
    phase,
    version = '3.2.4',
    timestamp,
    csp,
    sourceTrace,
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

  const humanTitle = classifyAndBuildTitle(error);
  const classified = classifyError(error);
  const { displayLine, displayCol, displayPath } = resolveErrorLocation(
    error, lineno, colno, templatePath, isJsCaller
  );
  const locDisplay = `${shortenPath(displayPath)}:${displayLine}:${displayCol}`;
  const canLinkLocation = isFilePath(displayPath);

  const header = buildErrorHeader(
    humanTitle,
    classified.category,
    classified.severity,
    phase,
    verbosity,
    displayPath,
    displayLine,
    displayCol,
    ide,
    canLinkLocation,
    locDisplay
  );

  const errorBody = buildErrorBodyContent(verbosity, error, classified, sourceTrace, renderContext, ide, displayPath);

  const footer = buildErrorFooter(version, timestamp, verbosity, canLinkLocation, ide, displayPath, displayLine, displayCol);

  const body = buildHtmlWrapper(header, errorBody, footer);

  const docTitle = classified.severity === 'warning' ? 'Template Warning' : 'Template Error';
  return document(docTitle, body, TOGGLE_SCRIPT, csp ?? null);
};

export { toHtml };
export type { ToHtmlOptions };

export { CSS, PRODUCTION_BODY } from './internal/styles.ts';
export { TOGGLE_SCRIPT } from './internal/script.ts';

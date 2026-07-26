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

const toHtml = async (error: ErrorLike | null, options: ToHtmlOptions = {}): Promise<string> => {
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

  const errWithExtras = error as {
    message?: string;
    code?: string | null;
    subject?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  const classified = classifyFromError(errWithExtras);
  const plain = toText(error, { verbosity: 'simple' });

  const category = error.code || classified.category.toUpperCase() || 'UNKNOWN';
  const undefinedName = classified.undefinedName || plain.match(UNDEFINED_OUTPUT_RE)?.[1] || null;

  let possibleCauses: string[];
  if (classified.causes && classified.causes.length > 0) {
    possibleCauses = [...classified.causes];
  } else {
    possibleCauses = [...(errWithExtras.causes || [])];
  }
  const fixCode = classified.fixCode ?? errWithExtras.fixCode ?? '';
  const fixComment = classified.fixComment ?? errWithExtras.fixComment ?? '';
  const documentationUrl = classified.documentationUrl ?? errWithExtras.documentationUrl ?? null;
  // Classification.severity is always populated, so it wins outright.
  const { severity } = classified;

  const humanTitle = resolveHumanTitle({ category, undefinedName, plain, fallback: classified.title || plain });

  let lineBaseValue: 'one' | 'zero';
  if (isJsCaller) {
    lineBaseValue = 'one';
  } else {
    lineBaseValue = error?.lineBase ?? 'zero';
  }
  const location = toDisplayLocation(
    lineno ?? error?.lineno ?? null,
    colno ?? error?.colno ?? null,
    lineBaseValue
  );
  const displayLine = location.line;
  const displayCol = location.col;
  const displayPath = templatePath || 'unknown';

  const codeBadge = renderBadge('badge-error', category);
  const phaseBadge = renderBadge('badge-code', phase);

  const ideMeta = getIdeMeta(ide);
  const ideLabel = `Open in ${ideMeta.label}`;

  const locDisplay = `${shortenPath(displayPath)}:${displayLine}:${displayCol}`;
  const canLinkLocation = isFilePath(displayPath);

  const headerTitle = escapeHtml(humanTitle);
  const locationInfo = escapeHtml(`${displayPath}:${displayLine}:${displayCol}`);

  const severityText = SEVERITY_HEADINGS[severity] ?? SEVERITY_HEADINGS.error;

  let phaseBadgePart = '';
  if (phaseBadge) {
    phaseBadgePart = ` ${phaseBadge}`;
  }

  let devBadge = '';
  if (verbosity === 'full') {
    devBadge = '<span class="badge badge-dev">DEV</span>';
  }

  let errorLocationBlock = '';
  if (verbosity !== 'simple') {
    let locationLink: string;
    if (canLinkLocation) {
      locationLink = `<a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="loc-link error-location-link">${escapeHtml(locDisplay)}</a>`;
    } else {
      locationLink = `<span class="error-location-text">${locationInfo}</span>`;
    }
    errorLocationBlock = `
    <p class="error-location">The error occurred in ${locationLink}</p>
    `;
  }

  let errorBody = '';
  if (verbosity === 'full') {
    const codeSection = renderSourceTraceSection(sourceTrace, displayPath);

    let possibleCausesList: string;
    if (possibleCauses.length > 0) {
      possibleCausesList = possibleCauses.map(c => `<li>${renderMarkdownToAnsi(c)}</li>`).join('\n          ');
    } else {
      possibleCausesList = '<li>Check template syntax and context</li>';
    }

    let fixCommentSpan = '';
    if (fixComment) {
      fixCommentSpan = `<span class="syntax-comment">${escapeHtml(fixComment)}</span>\n`;
    }
    let fixCodeBlock: string;
    if (fixCode) {
      fixCodeBlock = highlightHtml(fixCode);
    } else {
      fixCodeBlock = '// No fix available';
    }
    let docsLink = '';
    if (documentationUrl) {
      docsLink = `\n<span class="docs-inline">Learn more: <a href="${escapeHtml(documentationUrl)}" target="_blank" rel="noopener noreferrer" class="docs-link">${escapeHtml(documentationUrl)}</a></span>`;
    }

    let renderContextSection = '';
    if (renderContext) {
      renderContextSection = renderContextHtml(renderContext);
    }

    let stackTraceSection = '';
    if (error.stack) {
      stackTraceSection = formatStackTraceHtml(error, false, ide);
    }

    errorBody = `
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
  </div>
  `;
  }

  let footerActions = '';
  if (verbosity === 'full' && canLinkLocation) {
    footerActions = `
    <div class="error-footer-actions">
      <a href="${resolveIdeLink(ide, displayPath, displayLine, displayCol)}" class="btn btn-solid">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${ideMeta.icon}</svg>
        ${ideLabel}
      </a>
    </div>
  `;
  }

  let timestampPart = '';
  if (timestamp) {
    timestampPart = ` · ${escapeHtml(timestamp)}`;
  }

  const body = `
<main class="error-wrapper" aria-labelledby="err-title">
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
  </header>

  ${errorBody}

  <footer class="error-footer">
    <p class="meta">
      Nunjucks ${version}${timestampPart}
    </p>
    ${footerActions}
  </footer>
</main>`;

  let docTitle: string;
  if (severity === 'warning') {
    docTitle = 'Template Warning';
  } else {
    docTitle = 'Template Error';
  }
  return document(docTitle, body, TOGGLE_SCRIPT, csp ?? null);
};

export { toHtml };
export type { ToHtmlOptions };

export { CSS, PRODUCTION_BODY } from './internal/styles.ts';
export { TOGGLE_SCRIPT } from './internal/script.ts';

import { buildErrorHeader, buildErrorFooter, buildErrorBodyContent, buildHtmlWrapper } from './to-html-builder.ts';
import { classifyAndBuildTitle, buildErrorDisplay } from './to-html-helpers.ts';
import { isFilePath } from './internal/ide-links.ts';
import { CSS, } from './internal/styles.ts';
import { TOGGLE_SCRIPT } from './internal/script.ts';
import { shortenPath } from './internal/path-shortener.ts';
import type { Csp, ErrorLike, ToHtmlOptions } from './to-html-types.ts';
import type { SourceTrace } from './internal/source-trace.ts';

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
  const ref = options.timestamp ? `<p class="prod-ref">${options.timestamp}</p>` : '';
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

const buildErrorDocument = (
  error: ErrorLike,
  templatePath: string | undefined,
  lineno: number | undefined,
  colno: number | undefined,
  renderContext: unknown,
  phase: string,
  version: string,
  timestamp: string | undefined,
  csp: Csp | null,
  sourceTrace: SourceTrace | null | undefined,
  ide: string,
  verbosity: 'simple' | 'medium' | 'full',
  isJsCaller: boolean
): string => {
  const humanTitle = classifyAndBuildTitle(error);
  const { classified, displayLine, displayCol, displayPath } = buildErrorDisplay(error, templatePath, lineno, colno, isJsCaller);
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
  return document(docTitle, body, TOGGLE_SCRIPT, csp);
};

const toHtml = (error: ErrorLike | null, options: ToHtmlOptions = {}): string => {
  const {
    templatePath = error?.templateName ?? undefined,
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

  return buildErrorDocument(
    error,
    templatePath,
    lineno ?? undefined,
    colno ?? undefined,
    renderContext,
    phase ?? '',
    version,
    timestamp,
    csp ?? null,
    sourceTrace,
    ide,
    verbosity,
    isJsCaller
  );
};

export { toHtml };
export type { ToHtmlOptions };

export { CSS, PRODUCTION_BODY } from './internal/styles.ts';
export { TOGGLE_SCRIPT } from './internal/script.ts';

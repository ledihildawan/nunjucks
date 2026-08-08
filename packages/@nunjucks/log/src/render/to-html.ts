import { buildErrorHeader, buildErrorFooter, buildErrorBodyContent, buildHtmlWrapper } from './to-html-builder.ts';
import { classifyAndBuildTitle, buildErrorDisplay } from './to-html-display.ts';
import { isFilePath } from './internal/config/ide-links.ts';
import { shortenPath } from './internal/location/path-shortener.ts';
import { DEFAULT_IDE, DEFAULT_VERSION } from './internal/config/defaults.ts';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import scriptContent from './assets/error-script.js' with { type: 'text' };
import type { Csp, ErrorLike, ToHtmlOptions } from './to-html-types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(__dirname, './assets/error-page.css'), 'utf-8');

const TOGGLE_SCRIPT = `<script>\n${scriptContent}\n</script>`;

const buildDocument = ({ title, body, scripts = '', csp = null }: { title: string; body: string; scripts?: string; csp?: Csp | null }): string => {
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

const buildErrorDocument = (error: ErrorLike, options: ToHtmlOptions): string => {
  const {
    templatePath = error.templateName ?? undefined,
    lineno,
    colno,
    renderContext,
    version = DEFAULT_VERSION,
    timestamp,
    csp,
    sourceTrace,
    ide = DEFAULT_IDE,
    verbosity = 'full',
    isJsCaller = false
  } = options;

  const humanTitle = classifyAndBuildTitle(error);
  const { classified, displayLine, displayCol, displayPath } = buildErrorDisplay(error, { templatePath, lineno: lineno ?? undefined, colno: colno ?? undefined, isJsCaller });
  const locDisplay = `${shortenPath(displayPath)}:${displayLine}:${displayCol}`;
  const canLinkLocation = isFilePath(displayPath);

  const header = buildErrorHeader({
    humanTitle,
    category: classified.category,
    severity: classified.severity,
    phase: error.code ?? null,
    verbosity,
    displayPath: locDisplay,
    displayLine,
    displayCol,
    ide,
    canLinkLocation,
    locDisplay,
  });

  const errorBody = buildErrorBodyContent({ verbosity, error, classified, sourceTrace, renderContext, ide, displayPath });

  const footer = buildErrorFooter({ version, timestamp, verbosity, canLinkLocation, ide, displayPath, displayLine, displayCol });

  const body = buildHtmlWrapper(header, errorBody, footer);

  const docTitle = classified.severity === 'warning' ? 'Template Warning' : 'Template Error';
  return buildDocument({ title: docTitle, body, scripts: TOGGLE_SCRIPT, csp: csp ?? null });
};

const toHtml = (error: ErrorLike | null, options: ToHtmlOptions = {}): string => {
  const { csp } = options;

  if (!error) {
    return buildDocument({ title: 'Error', body: buildProductionBody(options), csp: csp ?? null });
  }

  if (options.isProduction) {
    return buildDocument({ title: 'Rendering Interrupted', body: buildProductionBody(options), csp: csp ?? null });
  }

  return buildErrorDocument(error, options);
};

export { toHtml };
export type { ToHtmlOptions };

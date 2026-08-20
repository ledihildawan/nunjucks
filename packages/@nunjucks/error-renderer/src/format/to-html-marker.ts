import { DEFAULT_IDE } from './presentation/ide-links/defaults.ts';
import { getIdeMeta, isFilePath, resolveIdeLink } from './presentation/ide-links/ide-links.ts';
import { shortenPath } from './presentation/source-trace/path-shortener.ts';
import { escapeAttribute, escapeHtml } from './presentation/syntax-highlight/highlight.ts';
import { toHtml } from './to-html.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

const escapeSrcdoc = (str: string): string =>
  JSON.stringify(str.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e'));

const ALERT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const BLOCK_CSS = `
.nj-err-block{margin:.5rem 0;background:light-dark(oklch(100% 0 0),oklch(18% 0.01 285));border:1px solid light-dark(oklch(90% 0.01 285),oklch(28% 0.02 285));border-block-start:.25rem solid light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));border-radius:.375rem;font-family:system-ui,-apple-system,sans-serif;font-size:.8125rem;color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));color-scheme:light dark;overflow:hidden;box-shadow:0 0 0 1px oklch(0 0 0/0.06),0 2px 4px -1px oklch(0 0 0/0.06),0 4px 8px 0 oklch(0 0 0/0.04);}
.nj-err-header{display:flex;align-items:center;gap:.5rem;padding:.625rem .875rem;background:linear-gradient(to bottom,light-dark(oklch(97% 0.03 25),oklch(25% 0.06 25)) 0%,light-dark(oklch(100% 0 0),oklch(18% 0.01 285)) 100%);border-bottom:1px solid light-dark(oklch(90% 0.01 285),oklch(28% 0.02 285));}
.nj-err-icon{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));display:flex;align-items:center;flex-shrink:0;cursor:pointer;transition:color .15s;}
.nj-err-icon:hover{color:light-dark(oklch(55% 0.22 25),oklch(75% 0.2 25));}
.nj-err-msg{font-size:.875rem;font-weight:600;color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.nj-err-loc{display:flex;align-items:center;gap:.375rem;padding:.5rem .875rem;background:light-dark(oklch(96% 0.01 285),oklch(22% 0.01 285));font-size:.6875rem;font-variant-numeric:tabular-nums;}
.nj-err-loc-label{color:light-dark(oklch(45% 0.02 285),oklch(75% 0.01 285));flex-shrink:0;}
.nj-err-loc-link{color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));text-decoration:none;font-family:ui-monospace,monospace;font-weight:600;overflow-wrap:anywhere;}
.nj-err-loc-link:hover{color:light-dark(oklch(45% 0.15 190),oklch(72% 0.13 190));text-decoration:underline;}
.nj-err-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.nj-err-overlay[hidden]{display:none;}
.nj-err-close{position:absolute;top:1rem;right:1rem;z-index:2;width:2.5rem;height:2.5rem;border-radius:50%;border:none;background:rgba(255,255,255,.9);color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.nj-err-close:hover{background:#fff;}
.nj-err-close svg{width:20px;height:20px;}
.nj-err-frame{border:none;width:100%;height:100%;background:#fff;}
`;

// WHY: inline markers are compact — a single icon that expands inline without disrupting the
// document flow. No border, no background, no location bar. Only the icon is visible.
// Clicking opens the same overlay as the block variant. This mirrors how browsers render
// broken images: a tiny placeholder that reveals details on interaction.
const INLINE_CSS = `
.nj-err-inline{display:inline-flex;align-items:center;vertical-align:middle;cursor:pointer;}
.nj-err-icon{color:light-dark(oklch(55% 0.18 25),oklch(70% 0.16 25));transition:color .15s;}
.nj-err-icon:hover,.nj-err-inline:hover .nj-err-icon{color:light-dark(oklch(45% 0.2 25),oklch(75% 0.15 25));}
.nj-err-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.nj-err-overlay[hidden]{display:none;}
.nj-err-close{position:absolute;top:1rem;right:1rem;z-index:2;width:2.5rem;height:2.5rem;border-radius:50%;border:none;background:rgba(255,255,255,.9);color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.nj-err-close:hover{background:#fff;}
.nj-err-close svg{width:20px;height:20px;}
.nj-err-frame{border:none;width:100%;height:100%;background:#fff;}
`;

type MarkerSeverity = 'block' | 'inline';

interface LocData {
  rawPath: string | null;
  displayPath: string | null;
  line: number | null;
  col: number | null;
  posSuffix: string;
  canLink: boolean;
}

const hashString = (str: string): string => {
  const hash = [...str].reduce((acc, char) => ((acc << 5) + acc) ^ char.charCodeAt(0), 5381);
  return (hash >>> 0).toString(16);
};

const createErrorId = (error: ErrorLike): string => {
  const parts = [
    error.message ?? '',
    error.templatePath ?? error.templateName ?? '',
    error.lineno?.toString() ?? '',
  ].join('|');
  return `nj-err-${hashString(parts)}`;
};

const extractLocData = (error: ErrorLike, projectRoot?: string): LocData => {
  const rawPath = error.templatePath ?? error.templateName ?? null;
  const line = error.lineno != null ? error.lineno : null;
  const col = error.colno != null ? error.colno : null;
  const posSuffix = [line, col].filter((v) => v !== null).join(':');
  return {
    rawPath,
    displayPath: rawPath ? shortenPath(rawPath, projectRoot ?? '') : null,
    line,
    col,
    posSuffix,
    canLink: rawPath !== null && isFilePath(rawPath),
  };
};

const buildLocationHtml = (loc: LocData, ide: string): string => {
  if (!loc.displayPath) {
    return '';
  }
  const locText = loc.posSuffix
    ? `${escapeHtml(loc.displayPath)}:${escapeHtml(loc.posSuffix)}`
    : escapeHtml(loc.displayPath);
  const ideMeta = getIdeMeta(ide);
  const link =
    loc.canLink && loc.rawPath
      ? `<a href="${escapeAttribute(resolveIdeLink(ide, { path: loc.rawPath, line: loc.line ?? 0, col: loc.col ?? 0 }))}" class="nj-err-loc-link" title="Open in ${escapeAttribute(ideMeta.label)}">${locText}</a>`
      : `<span class="nj-err-loc-link">${locText}</span>`;
  return `<div class="nj-err-loc"><span class="nj-err-loc-label">The error occurred in</span> ${link}</div>`;
};

// WHY: severity is injected by the render stream based on the error's catalog code.
// BLOCK = structural/security/system failure — full block with header, message, location.
// INLINE = expression-level recoverable failure — compact icon inline in the text flow.
/**
 * Renders a compact in-document error marker: a clickable block or inline icon that
 * lazily opens an overlay whose iframe loads the full `toHtml` error page as `srcdoc`.
 *
 * @param error - Error-like payload: `message` (fallback `'Unknown error'`), optional
 *   `templatePath`/`templateName`, `lineno`/`colno` drive the location row and the
 *   marker's stable id.
 * @param options - `ToHtmlOptions` forwarded verbatim to the embedded page (`dev`
 *   gates diagnostics, `csp.nonce` threads onto its tags, `humanTitle` overrides the
 *   header text, `projectRoot`/`ide` shape the location link) plus `severity`:
 *   `'block'` (default) renders the full header + location bar, `'inline'` renders
 *   only the inline icon. Escaping is applied to every interpolated value; the
 *   `srcdoc` JSON literal escapes `<`/`>` so it cannot break out of the script.
 * @returns The `<style>` + marker + overlay + `<script>` HTML fragment. Never throws —
 *   absent fields degrade to placeholders, and a non-file path renders a plain span
 *   instead of an IDE link.
 */
// WHY: lazy iframe — the full error page is only built into the DOM when the marker is
// first opened; sandbox="allow-scripts" permits the page's own toggle script (the only
// interactivity it has) while srcdoc keeps the frame originless, so scripts run without
// same-origin access to the host document.
const IFRAME_SETUP = `f.className='nj-err-frame';f.setAttribute('sandbox','allow-scripts');`;

const toHtmlMarker = (
  error: ErrorLike,
  options: ToHtmlOptions & { severity?: MarkerSeverity } = {}
): string => {
  const severity: MarkerSeverity = options.severity ?? 'block';
  // WHY: keep the raw title — the visible text gets escapeHtml and the
  // data-nj-err-full attribute gets escapeAttribute, each exactly once;
  // pre-escaping here double-encoded the overflow tooltip as literal entities.
  const rawTitle = options.humanTitle ?? error.message ?? 'Unknown error';
  const message = escapeHtml(rawTitle);
  const id = createErrorId(error);
  const fullPage = toHtml(error, options);
  const srcdocLiteral = escapeSrcdoc(fullPage);
  const css = severity === 'inline' ? INLINE_CSS : BLOCK_CSS;
  const locHtml =
    severity === 'block'
      ? buildLocationHtml(extractLocData(error, options.projectRoot), options.ide ?? DEFAULT_IDE)
      : '';

  if (severity === 'inline') {
    const idAttr = escapeAttribute(id);
    // WHY: resolve THIS marker's button/overlay by its unique id — a plain
    // '[data-nj-err-open]' querySelector would bind the FIRST marker in the
    // document and leave every later marker's button dead.
    const openSel = `[data-nj-err-open="${idAttr}"]`;
    return `<style>${css}</style>
<span class="nj-err-inline" role="status" aria-live="polite">
  <span class="nj-err-icon" data-nj-err-open="${idAttr}" role="button" tabindex="0" aria-label="${message} — click to view details" title="${message}">${ALERT_ICON}</span>
</span>
<div class="nj-err-overlay" id="${idAttr}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){const b=document.querySelector('${openSel}');const o=document.getElementById('${idAttr}');if(!b||!o)return;const c=o.querySelector(".nj-err-close");let loaded=false;const open=function(){if(!loaded){loaded=true;const f=document.createElement('iframe');${IFRAME_SETUP}f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";};const close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",open);b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o){close();}});})()</script>`;
  }

  const idAttr = escapeAttribute(id);
  // WHY: same id-scoped resolution as the inline variant — see note above.
  const openSel = `[data-nj-err-open="${idAttr}"]`;
  return `<style>${css}</style>
<div class="nj-err-block" role="status" aria-live="polite">
  <div class="nj-err-header">
    <span class="nj-err-icon" data-nj-err-open="${idAttr}" role="button" tabindex="0" aria-label="View error details" title="Click to view details">${ALERT_ICON}</span>
    <span class="nj-err-msg" data-nj-err-full="${escapeAttribute(rawTitle)}">${message}</span>
  </div>
  ${locHtml}
</div>
<div class="nj-err-overlay" id="${idAttr}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){const b=document.querySelector('${openSel}');const o=document.getElementById('${idAttr}');if(!b||!o)return;const m=o.closest('.nj-err-block')?.querySelector('.nj-err-msg[data-nj-err-full]');const checkOverflow=function(){if(!m)return;const full=m.getAttribute('data-nj-err-full');if(m.scrollWidth>m.clientWidth){m.setAttribute('title',full);}else{m.removeAttribute('title');}};checkOverflow();window.addEventListener('resize',checkOverflow);const c=o.querySelector(".nj-err-close");let loaded=false;const open=function(){if(!loaded){loaded=true;const f=document.createElement('iframe');${IFRAME_SETUP}f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";};const close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",open);b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o){close();}});})()</script>`;
};

export { toHtmlMarker };

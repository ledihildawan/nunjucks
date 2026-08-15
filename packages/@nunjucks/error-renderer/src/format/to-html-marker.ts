import { getIdeMeta, isFilePath, resolveIdeLink } from './presentation/ide-links/ide-links.ts';
import { shortenPath } from './presentation/source-trace/path-shortener.ts';
import { escapeAttribute, escapeHtml } from './presentation/syntax-highlight/highlight.ts';
import { toHtml } from './to-html.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

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

const makeErrorId = (error: ErrorLike): string => {
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
const toHtmlMarker = (
  error: ErrorLike,
  options: ToHtmlOptions & { severity?: MarkerSeverity } = {}
): string => {
  const severity: MarkerSeverity = options.severity ?? 'block';
  const message = escapeHtml(options.humanTitle ?? error.message ?? 'Unknown error');
  const id = makeErrorId(error);
  const fullPage = toHtml(error, options);
  const srcdocLiteral = JSON.stringify(fullPage).replaceAll('</', '<\\/');
  const css = severity === 'inline' ? INLINE_CSS : BLOCK_CSS;
  const locHtml =
    severity === 'block'
      ? buildLocationHtml(extractLocData(error, options.projectRoot), options.ide ?? 'vscode')
      : '';

  if (severity === 'inline') {
    // Compact inline icon — no block wrapper, no location bar, no message text.
    // Clicking the icon opens the same overlay as the block variant.
    return `<style>${css}</style>
<span class="nj-err-inline" role="status" aria-live="polite">
  <span class="nj-err-icon" data-nj-err-open="${id}" role="button" tabindex="0" aria-label="${message} — click to view details" title="${message}">${ALERT_ICON}</span>
</span>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var c=o.querySelector(".nj-err-close");var loaded=false;var open=function(){if(!loaded){loaded=true;var f=document.createElement('iframe');f.className='nj-err-frame';f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";};var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",open);b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o){close();}});})()</script>`;
  }

  // Full block — header with icon + message + location bar
  return `<style>${css}</style>
<div class="nj-err-block" role="status" aria-live="polite">
  <div class="nj-err-header">
    <span class="nj-err-icon" data-nj-err-open="${id}" role="button" tabindex="0" aria-label="View error details" title="Click to view details">${ALERT_ICON}</span>
    <span class="nj-err-msg" data-nj-err-full="${message}">${message}</span>
  </div>
  ${locHtml}
</div>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var m=document.querySelector('.nj-err-msg[data-nj-err-full]');var checkOverflow=function(){if(!m)return;var full=m.getAttribute('data-nj-err-full');if(m.scrollWidth>m.clientWidth){m.setAttribute('title',full);}else{m.removeAttribute('title');}};checkOverflow();window.addEventListener('resize',checkOverflow);var c=o.querySelector(".nj-err-close");var loaded=false;var open=function(){if(!loaded){loaded=true;var f=document.createElement('iframe');f.className='nj-err-frame';f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";};var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",open);b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o){close();}});})()</script>`;
};

export { toHtmlMarker };

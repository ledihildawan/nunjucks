import { toHtml } from './to-html.ts';
import { classifyAndBuildTitle } from './to-html-display.ts';
import { escapeHtml } from './internal/highlight/highlight.ts';
import { shortenPath } from './internal/location/path-shortener.ts';
import { resolveIdeLink, isFilePath } from './internal/config/ide-links.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

const ALERT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

const FILE_ICON = '<svg class="nj-err-file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';

const CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const MARKER_CSS = `
.nj-err-block{margin:.5rem 0;background:light-dark(oklch(100% 0 0),oklch(18% 0.01 285));border:1px solid light-dark(oklch(90% 0.01 285),oklch(28% 0.02 285));border-block-start:.25rem solid light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));border-radius:.375rem;font-family:system-ui,-apple-system,sans-serif;font-size:.8125rem;color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));color-scheme:light dark;overflow:hidden;box-shadow:0 0 0 1px oklch(0 0 0/0.06),0 2px 4px -1px oklch(0 0 0/0.06),0 4px 8px 0 oklch(0 0 0/0.04);}
.nj-err-header{padding:.625rem .875rem;background:linear-gradient(to bottom,light-dark(oklch(97% 0.03 25),oklch(25% 0.06 25)) 0%,light-dark(oklch(100% 0 0),oklch(18% 0.01 285)) 100%);border-bottom:1px solid light-dark(oklch(90% 0.01 285),oklch(28% 0.02 285));}
.nj-err-title-row{display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:.25rem;}
.nj-err-icon{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));display:flex;align-items:center;flex-shrink:0;}
.nj-err-label{font-size:.6875rem;font-weight:700;color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));text-transform:uppercase;letter-spacing:.05em;}
.nj-err-tag{background:light-dark(oklch(97% 0.03 25),oklch(25% 0.06 25));color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));font-size:.625rem;font-weight:700;padding:.2em .6em;border-radius:.25rem;letter-spacing:.05em;}
.nj-err-msg{font-size:.875rem;font-weight:600;color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));line-height:1.3;overflow-wrap:anywhere;}
.nj-err-actions{display:flex;align-items:center;flex-shrink:0;margin-left:auto;}
.nj-err-btn{background:light-dark(oklch(20% 0.02 285),oklch(90% 0.01 285));border:1px solid transparent;color:light-dark(oklch(98% 0.01 285),oklch(15% 0.01 285));padding:.4em .8em;border-radius:.25rem;font-size:.6875rem;font-weight:600;cursor:pointer;white-space:nowrap;box-shadow:0 0 0 .5px oklch(0 0 0/.3),0 1px 2px oklch(0 0 0/.1);}
.nj-err-btn:hover{background:light-dark(oklch(35% 0.02 285),oklch(100% 0 0));}
.nj-err-loc{display:flex;align-items:center;gap:.375rem;padding:.5rem .875rem;background:light-dark(oklch(96% 0.01 285),oklch(22% 0.01 285));font-size:.6875rem;font-variant-numeric:tabular-nums;}
.nj-err-loc-label{color:light-dark(oklch(45% 0.02 285),oklch(75% 0.01 285));flex-shrink:0;}
.nj-err-loc-link{display:inline-flex;align-items:center;gap:.25rem;color:light-dark(oklch(20% 0.02 285),oklch(95% 0.01 285));text-decoration:none;font-family:ui-monospace,monospace;font-weight:600;overflow-wrap:anywhere;}
.nj-err-loc-link:hover{color:light-dark(oklch(45% 0.15 190),oklch(72% 0.13 190));text-decoration:underline;}
.nj-err-file-icon{flex-shrink:0;opacity:.6;}
.nj-err-pos{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));font-weight:700;}
.nj-err-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.nj-err-overlay[hidden]{display:none;}
.nj-err-close{position:absolute;top:1rem;right:1rem;z-index:2;width:2.5rem;height:2.5rem;border-radius:50%;border:none;background:rgba(255,255,255,.9);color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.nj-err-close:hover{background:#fff;}
.nj-err-close svg{width:20px;height:20px;}
.nj-err-frame{border:none;width:100%;height:100%;background:#fff;}
`;

interface LocData {
  rawPath: string | null;
  displayPath: string | null;
  line: number | null;
  col: number | null;
  posSuffix: string;
  canLink: boolean;
}

const extractLocData = (error: ErrorLike): LocData => {
  const rawPath = error.templatePath ?? error.templateName ?? null;
  const line = error.lineno != null ? error.lineno : null;
  const col = error.colno != null ? error.colno : null;
  const posSuffix = [line, col].filter(v => v !== null).join(':');
  return {
    rawPath,
    displayPath: rawPath ? shortenPath(rawPath) : null,
    line,
    col,
    posSuffix,
    canLink: rawPath !== null && isFilePath(rawPath),
  };
};

const buildLocationHtml = (loc: LocData): string => {
  if (!loc.displayPath) { return ''; }
  const posSpan = loc.posSuffix ? `<span class="nj-err-pos">:${escapeHtml(loc.posSuffix)}</span>` : '';
  const inner = `${FILE_ICON}<span>${escapeHtml(loc.displayPath)}${posSpan}</span>`;
  const link = loc.canLink && loc.rawPath
    ? `<a href="${resolveIdeLink('vscode', { path: loc.rawPath, line: loc.line ?? 0, col: loc.col ?? 0 })}" class="nj-err-loc-link" title="Open in VSCode">${inner}</a>`
    : `<span class="nj-err-loc-link">${inner}</span>`;
  return `<div class="nj-err-loc">The error occurred in ${link}</div>`;
};

const toHtmlMarker = (error: ErrorLike, options: ToHtmlOptions = {}): string => {
  const message = escapeHtml(classifyAndBuildTitle(error));
  const tag = error.code ? escapeHtml(error.code) : 'ERROR';
  const id = `nj-err-${Math.random().toString(36).slice(2, 8)}`;
  const fullPage = toHtml(error, options);
  const srcdocLiteral = JSON.stringify(fullPage).replaceAll('</', '<\\/');
  const locHtml = buildLocationHtml(extractLocData(error));

  return `<style>${MARKER_CSS}</style>
<div class="nj-err-block" role="status" aria-live="polite">
  <div class="nj-err-header">
    <div class="nj-err-title-row">
      <span class="nj-err-icon">${ALERT_ICON}</span>
      <span class="nj-err-label">Template Error</span>
      <span class="nj-err-tag">${tag}</span>
      <div class="nj-err-actions">
        <button type="button" class="nj-err-btn" data-nj-err-open="${id}" aria-label="View error details">Detail</button>
      </div>
    </div>
    <div class="nj-err-msg" title="${message}">${message}</div>
  </div>
  ${locHtml}
</div>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var c=o.querySelector(".nj-err-close");var loaded=false;var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",function(){if(!loaded){loaded=true;var f=document.createElement('iframe');f.className='nj-err-frame';f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!o.hidden)close();});})();</script>`;
};

export { toHtmlMarker };
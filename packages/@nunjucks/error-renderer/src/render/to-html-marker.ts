import { toHtml } from './to-html.ts';
import { classifyAndBuildTitle } from './to-html-display.ts';
import { escapeHtml } from './internal/highlight/highlight.ts';
import { shortenPath } from './internal/location/path-shortener.ts';
import { resolveIdeLink, isFilePath } from './internal/config/ide-links.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

const ALERT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

const FILE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';

const CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const MARKER_CSS = `
.nj-err-block{margin:.625rem 0;border:1px solid light-dark(oklch(90% 0.03 25),oklch(28% 0.04 25));border-left:4px solid light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));border-radius:.375rem;font-family:system-ui,-apple-system,sans-serif;font-size:.8125rem;color:light-dark(oklch(25% 0.02 285),oklch(90% 0.01 285));color-scheme:light dark;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);}
.nj-err-header{display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;gap:.75rem;}
.nj-err-meta{display:flex;align-items:center;gap:.5rem;min-width:0;}
.nj-err-icon{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));display:flex;align-items:center;flex-shrink:0;}
.nj-err-tag{background:light-dark(oklch(93% 0.05 25),oklch(30% 0.08 25));color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));font-size:.625rem;font-weight:700;padding:.125rem .375rem;border-radius:.25rem;letter-spacing:.05em;flex-shrink:0;}
.nj-err-msg{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:600;color:light-dark(oklch(45% 0.15 25),oklch(72% 0.13 25));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nj-err-actions{display:flex;align-items:center;gap:.375rem;flex-shrink:0;}
.nj-err-btn{background:light-dark(oklch(100% 0 0),oklch(18% 0.01 285));border:1px solid light-dark(oklch(85% 0.02 25),oklch(35% 0.03 25));color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));padding:.1875rem .5rem;border-radius:.25rem;font-size:.6875rem;font-weight:600;cursor:pointer;}
.nj-err-btn:hover{background:light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));color:light-dark(oklch(98% 0.01 285),oklch(15% 0.01 285));border-color:light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));}
.nj-err-loc{display:flex;align-items:center;gap:.375rem;padding:.375rem .75rem;background:light-dark(oklch(97% 0.01 25),oklch(20% 0.01 285));border-top:1px dashed light-dark(oklch(90% 0.01 25),oklch(28% 0.02 285));font-size:.6875rem;}
.nj-err-loc-label{color:light-dark(oklch(55% 0.01 285),oklch(60% 0.01 285));font-weight:500;text-transform:uppercase;font-size:.5625rem;letter-spacing:.05em;}
.nj-err-loc-link{display:inline-flex;align-items:center;gap:.25rem;color:light-dark(oklch(45% 0.02 285),oklch(75% 0.01 285));text-decoration:none;font-family:ui-monospace,monospace;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.nj-err-loc-link:hover{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));text-decoration:underline;}
.nj-err-file-icon{flex-shrink:0;opacity:.7;}
.nj-err-path{overflow:hidden;text-overflow:ellipsis;}
.nj-err-pos{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));font-weight:600;}
.nj-err-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.nj-err-overlay[hidden]{display:none;}
.nj-err-close{position:absolute;top:1rem;right:1rem;z-index:2;width:2.5rem;height:2.5rem;border-radius:50%;border:none;background:rgba(255,255,255,.9);color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.nj-err-close:hover{background:#fff;}
.nj-err-close svg{width:20px;height:20px;}
.nj-err-frame{border:none;width:100%;height:100%;background:#fff;}
`;

const toHtmlMarker = (error: ErrorLike, options: ToHtmlOptions = {}): string => {
  const message = escapeHtml(classifyAndBuildTitle(error));
  const id = `nj-err-${Math.random().toString(36).slice(2, 8)}`;
  const fullPage = toHtml(error, options);
  const srcdocLiteral = JSON.stringify(fullPage).replaceAll('</', '<\\/');

  const rawPath = error.templatePath ?? error.templateName ?? null;
  const displayPath = rawPath ? shortenPath(rawPath) : null;
  const line = error.lineno != null ? error.lineno : null;
  const col = error.colno != null ? error.colno : null;
  const canLink = rawPath !== null && isFilePath(rawPath);

  const posStr = `:${line ?? 0}:${col ?? 0}`;
  const pathHtml = escapeHtml(displayPath ?? '');
  const locInner = canLink && rawPath
    ? `<a href="${resolveIdeLink('vscode', { path: rawPath, line: line ?? 0, col: col ?? 0 })}" class="nj-err-loc-link" title="Open in VS Code">${FILE_ICON}<span class="nj-err-path">${pathHtml}<span class="nj-err-pos">${posStr}</span></span></a>`
    : `<span class="nj-err-loc-link">${FILE_ICON}<span class="nj-err-path">${pathHtml}${posStr}</span></span>`;
  const locHtml = (displayPath || line != null)
    ? `<div class="nj-err-loc"><span class="nj-err-loc-label">Source:</span>${locInner}</div>`
    : '';

  return `<style>${MARKER_CSS}</style>
<div class="nj-err-block" role="status" aria-live="polite">
  <div class="nj-err-header">
    <div class="nj-err-meta">
      <span class="nj-err-icon" aria-hidden="true">${ALERT_ICON}</span>
      <span class="nj-err-tag">STREAM ERROR</span>
      <span class="nj-err-msg">${message}</span>
    </div>
    <div class="nj-err-actions">
      <button type="button" class="nj-err-btn" data-nj-err-open="${id}" title="View full diagnostic">Detail</button>
    </div>
  </div>
  ${locHtml}
</div>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var c=o.querySelector(".nj-err-close");var loaded=false;var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",function(){if(!loaded){loaded=true;var f=document.createElement('iframe');f.className='nj-err-frame';f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!o.hidden)close();});})();</script>`;
};

export { toHtmlMarker };
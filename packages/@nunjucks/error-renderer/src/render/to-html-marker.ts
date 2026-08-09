import { toHtml } from './to-html.ts';
import { classifyAndBuildTitle } from './to-html-display.ts';
import { escapeHtml } from './internal/highlight/highlight.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

const ALERT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

const CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const MARKER_CSS = `
.nj-err-block{margin:.5rem 0;padding:.5rem .75rem;background:light-dark(oklch(97% 0.03 25),oklch(25% 0.06 25));border-left:3px solid light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));border-radius:0 .375rem .375rem 0;font-family:system-ui,-apple-system,sans-serif;font-size:.8125rem;color:light-dark(oklch(25% 0.02 285),oklch(90% 0.01 285));color-scheme:light dark;}
.nj-err-header{display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
.nj-err-meta{display:flex;align-items:center;gap:.375rem;overflow:hidden;min-width:0;}
.nj-err-icon{color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));flex-shrink:0;}
.nj-err-label{font-weight:600;color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));white-space:nowrap;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;}
.nj-err-msg{color:light-dark(oklch(45% 0.02 285),oklch(75% 0.01 285));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,monospace;font-size:.75rem;}
.nj-err-detail{background:transparent;border:1px solid light-dark(oklch(90% 0.01 285),oklch(28% 0.02 285));color:light-dark(oklch(45% 0.2 25),oklch(70% 0.18 25));padding:.125rem .5rem;border-radius:.25rem;font-size:.6875rem;font-weight:500;cursor:pointer;white-space:nowrap;}
.nj-err-detail:hover{background:light-dark(oklch(96% 0.01 285),oklch(22% 0.01 285));border-color:light-dark(oklch(60% 0.2 25),oklch(65% 0.2 25));}
.nj-err-loc{margin-top:.25rem;color:light-dark(oklch(45% 0.02 285),oklch(75% 0.01 285));font-size:.6875rem;font-variant-numeric:tabular-nums;}
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

  const locParts = [
    error.templatePath ?? error.templateName,
    error.lineno != null ? String(error.lineno) : null,
    error.colno != null ? String(error.colno) : null
  ].filter(Boolean);
  const locHtml = locParts.length > 0
    ? `<div class="nj-err-loc">${escapeHtml(locParts.join(':'))}</div>`
    : '';

  return `<style>${MARKER_CSS}</style>
<div class="nj-err-block" role="status" aria-live="polite">
  <div class="nj-err-header">
    <div class="nj-err-meta">
      <span class="nj-err-icon">${ALERT_ICON}</span>
      <span class="nj-err-label">Stream Error</span>
      <span class="nj-err-msg">${message}</span>
    </div>
    <button type="button" class="nj-err-detail" data-nj-err-open="${id}">Detail</button>
  </div>
  ${locHtml}
</div>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">${CLOSE_ICON}</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var c=o.querySelector(".nj-err-close");var loaded=false;var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",function(){if(!loaded){loaded=true;var f=document.createElement('iframe');f.className='nj-err-frame';f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!o.hidden)close();});})();</script>`;
};

export { toHtmlMarker };
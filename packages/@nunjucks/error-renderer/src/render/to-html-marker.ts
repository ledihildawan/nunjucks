import { toHtml } from './to-html.ts';
import { classifyAndBuildTitle } from './to-html-display.ts';
import { escapeHtml } from './internal/highlight/highlight.ts';
import type { ErrorLike, ToHtmlOptions } from './to-html-types.ts';

// WHY: light-DOM chrome for the inline marker, hover tooltip, full-screen overlay, close button, and iframe. Scoped under nj-err-* prefixes to avoid clashing with the host page's CSS.
const MARKER_CHROME_CSS = `
.nj-err-mark{display:inline-flex;align-items:center;justify-content:center;min-width:1.15em;height:1.15em;border-radius:50%;background:#d23;color:#fff;font:bold .7em/1.1 system-ui,sans-serif;border:none;cursor:pointer;vertical-align:baseline;margin:0 1px;position:relative;animation:nj-err-pulse 1.8s ease-in-out infinite;}
@keyframes nj-err-pulse{0%,100%{box-shadow:0 0 0 0 rgba(221,34,51,.5)}50%{box-shadow:0 0 0 4px rgba(221,34,51,0)}}
.nj-err-mark .nj-err-tip{position:absolute;bottom:140%;left:50%;transform:translateX(-50%);background:#1b1b1b;color:#fff;padding:.3em .55em;border-radius:.3em;font:normal 600 .75em/1.3 system-ui;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none;transition:opacity .12s ease-out;z-index:2147483647;}
.nj-err-mark:hover .nj-err-tip,.nj-err-mark:focus-visible .nj-err-tip{opacity:1;}
.nj-err-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.nj-err-overlay[hidden]{display:none;}
.nj-err-close{position:absolute;top:1rem;right:1rem;z-index:2;width:2.5rem;height:2.5rem;border-radius:50%;border:none;background:rgba(255,255,255,.9);color:#333;font-size:1.1rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:background .15s,transform .15s;}
.nj-err-close:hover{background:#fff;transform:scale(1.08);}
.nj-err-frame{border:none;width:100%;height:100%;background:#fff;}
`;

// WHY: mid-stream error marker — a small inline red "!" at the exact failure position with a hover tooltip. Clicking opens a FULL-SCREEN overlay containing an <iframe> that renders the complete standalone error page (toHtml output). iframe gives total CSS/script isolation — every feature (toggle scripts, context tree, source highlighting) works exactly as the standalone version, with zero clash. The overlay is a plain fixed div (not <dialog>) for maximum layout control. Close via the ✕ button, clicking the backdrop, or pressing Escape.
const toHtmlMarker = (error: ErrorLike, options: ToHtmlOptions = {}): string => {
  const message = escapeHtml(classifyAndBuildTitle(error));
  const id = `nj-err-${Math.random().toString(36).slice(2, 8)}`;
  const fullPage = toHtml(error, options);

  // WHY: escape </ → <\/ inside the JSON literal so </script> in the embedded page does not prematurely close the inline script tag.
  const srcdocLiteral = JSON.stringify(fullPage).replaceAll('</', '<\\/');

  return `<style>${MARKER_CHROME_CSS}</style>
<button class="nj-err-mark" type="button" data-nj-err-open="${id}" aria-label="Template error: ${message}">!<span class="nj-err-tip">${message}</span></button>
<div class="nj-err-overlay" id="${id}" hidden>
  <button class="nj-err-close" type="button" aria-label="Close error overlay">\u2715</button>
</div>
<script>(function(){var b=document.querySelector('[data-nj-err-open="${id}"]');var o=document.getElementById("${id}");if(!b||!o)return;var c=o.querySelector(".nj-err-close");var loaded=false;var close=function(){o.setAttribute("hidden","");document.body.style.overflow="";};b.addEventListener("click",function(){if(!loaded){loaded=true;var f=document.createElement("iframe");f.className="nj-err-frame";f.srcdoc=${srcdocLiteral};o.appendChild(f);}o.removeAttribute("hidden");document.body.style.overflow="hidden";});c.addEventListener("click",close);o.addEventListener("click",function(e){if(e.target===o)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!o.hidden)close();});})();</script>`;
};

export { toHtmlMarker };

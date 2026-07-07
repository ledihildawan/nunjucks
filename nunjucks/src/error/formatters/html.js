import { formatLocation, getDisplayMessage } from '../state/data.js';

const escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
};

const highlightHtml = (code) => {
  return escapeHtml(code);
};

const formatCodeTraceHtml = (snippet) => {
  if (!snippet) return '<div class="code-line"><span class="line-number">&nbsp;</span><span>Source not available</span></div>';

  const lines = snippet.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    const isError = trimmed.startsWith('>>>');

    if (isError) {
      const content = trimmed.replace(/^>>>\s*/, '');
      const colonIdx = content.indexOf(':');
      const lineNum = colonIdx > 0 ? content.substring(0, colonIdx) : '';
      const code = colonIdx > 0 ? content.substring(colonIdx + 1).trim() : content;
      return `<div class="code-line is-error"><span class="line-number">${lineNum}</span><span>&nbsp;&nbsp;<span style="color: #FF7B72; font-weight: bold;">${highlightHtml(code)}</span></span></div>`;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const lineNum = trimmed.substring(0, colonIdx);
      const code = trimmed.substring(colonIdx + 1).trim();
      return `<div class="code-line"><span class="line-number">${lineNum}</span><span style="color: #8B949E;">${highlightHtml(code)}</span></div>`;
    }

    return `<div class="code-line"><span class="line-number">&nbsp;</span><span style="color: #6B7280;">${escapeHtml(trimmed)}</span></div>`;
  }).join('');
};

const renderContextHtml = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx);
  if (keys.length === 0) return '';

  const rows = keys.map((k) => {
    const raw = ctx[k];
    const val = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return `<div style="display:flex;gap:12px;padding:6px 12px;border-bottom:1px solid var(--color-border);font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;"><span style="color:oklch(70% 0.15 190);min-width:120px;flex-shrink:0;">${escapeHtml(k)}</span><span style="color:var(--color-code-text);word-break:break-all;">${escapeHtml(val)}</span></div>`;
  }).join('');

  return `
    <div style="margin-bottom: 32px;">
      <div class="text-label">Render Context</div>
      <div style="background:var(--color-code-bg);border-radius:8px;overflow:hidden;border:1px solid var(--color-border);">${rows}</div>
    </div>`;
};

const formatStackTraceHtml = (originalError, isProduction = false) => {
  if (!originalError?.stack) return '';

  const stackLines = originalError.stack.split('\n').slice(1);
  if (stackLines.length === 0) return '';

  const jsStackLines = stackLines.filter(line => line.trim().startsWith('at '));
  if (jsStackLines.length === 0) return '';

  const linesToShow = isProduction
    ? jsStackLines.filter(line => {
        const path = line.toLowerCase();
        return !path.includes('nunjucks/nunjucks/src/') && !path.includes('nunjucks\\nunjucks\\src\\');
      })
    : jsStackLines;

  if (linesToShow.length === 0) return '';

  const rows = linesToShow.map(line => {
    const trimmed = escapeHtml(line.trim());
    return `<div class="stack-row"><span style="font-family:monospace;color:var(--color-code-text);">${trimmed}</span></div>`;
  }).join('');

  return `
    <div style="margin-bottom:32px;">
      <div class="text-label">Stack Trace</div>
      <div class="stack-container">${rows}</div>
    </div>
  `;
};

const CSS = `
.error-wrapper{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;max-width:800px;margin:40px auto;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);color:var(--color-text-primary);line-height:1.5;overflow:hidden;border-top:4px solid var(--color-error-border);transition:background-color 0.3s ease,color 0.3s ease}
.text-label{font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px}
.error-header{padding:24px 32px;border-bottom:1px solid var(--color-border);background:linear-gradient(to bottom,var(--color-error-bg) 0%,var(--color-bg-panel) 100%)}
.error-header-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--color-error-text);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
.code-block{background:var(--color-code-bg);color:var(--color-code-text);border-radius:8px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;overflow:hidden;padding:12px 0}
.code-line{display:flex;padding:4px 20px}
.code-line.is-error{background:var(--color-code-highlight-bg);border-left:3px solid var(--color-error-border);padding-left:17px}
.line-number{color:var(--color-code-line-number);width:24px;user-select:none;text-align:right;margin-right:20px}
.stack-container{font-size:13px;border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
.stack-row{display:flex;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--color-border);transition:background-color 0.15s ease}
.stack-row:hover{background-color:light-dark(oklch(95% 0.01 285), oklch(22% 0.02 285))}
.stack-row:last-child{border-bottom:none}
.btn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s ease;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-solid{background:light-dark(oklch(20% 0.02 285), oklch(90% 0.01 285));color:light-dark(oklch(98% 0.01 285), oklch(10% 0.01 285));border:1px solid transparent}
.btn-solid:hover{background:light-dark(oklch(35% 0.02 285), oklch(100% 0 0))}
.causes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;margin-bottom:32px}
.syntax-tag{color:oklch(75% 0.15 190)}
.syntax-attr{color:oklch(80% 0.12 110)}
`;

const CSS_VARS = `
:root {
  color-scheme: light dark;
  --color-bg-panel: light-dark(oklch(99% 0.005 285), oklch(18% 0.01 285));
  --color-bg-page: light-dark(oklch(97% 0.01 285), oklch(12% 0.01 285));
  --color-text-primary: light-dark(oklch(15% 0.02 285), oklch(95% 0.01 285));
  --color-text-secondary: light-dark(oklch(45% 0.02 285), oklch(75% 0.01 285));
  --color-border: light-dark(oklch(90% 0.01 285), oklch(25% 0.02 285));
  --color-error-text: oklch(60% 0.18 25);
  --color-error-bg: light-dark(oklch(95% 0.03 25), oklch(25% 0.06 25));
  --color-error-border: oklch(65% 0.2 25);
  --color-code-bg: light-dark(oklch(20% 0.01 285), oklch(10% 0.01 285));
  --color-code-text: oklch(90% 0.01 285);
  --color-code-line-number: oklch(55% 0.01 285);
  --color-code-highlight-bg: oklch(30% 0.08 25);
}
`;

const PRODUCTION_HTML = `
<div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 48px auto; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); text-align: center;">
  <div style="margin-bottom: 20px;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="#DC2626"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <div style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px;">Rendering Interrupted</div>
  <div style="font-size: 14px; color: #6B7280; margin-bottom: 20px;">An error occurred during template rendering.</div>
  <div style="font-size: 13px; color: #9CA3AF;">Check server logs for details.</div>
</div>
`;

export const toHtmlString = (state) => {
  const {
    templatePath,
    snippet,
    classified,
    getDisplayLine,
    getDisplayCol,
    isProduction,
    originalError,
    renderContext
  } = state;

  if (isProduction) {
    return PRODUCTION_HTML;
  }

  const headerTitle = escapeHtml(getDisplayMessage(state));
  const locationInfo = escapeHtml(formatLocation(state));
  const possibleCauses = classified?.causes ?? ['Check template syntax', 'Verify variable scope'];
  const fixCode = classified?.fixCode ?? "env.addGlobal('fn', callback)";
  const fixComment = classified?.fixComment ?? '// Register global function';

  return `
<style>
${CSS_VARS}
${CSS}
</style>

<div class="error-wrapper">
  <div class="error-header">
    <div class="error-header-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Template Rendering Error
    </div>
    <div style="font-size: 24px; font-weight: 600;">${headerTitle}</div>
    <div style="margin-top: 8px; font-size: 15px; color: var(--color-text-secondary);">
      The error occurred in <span style="font-weight: 600; color: var(--color-text-primary);">${locationInfo}</span>
    </div>
  </div>

  <div style="padding: 32px;">
    <div style="margin-bottom: 32px;">
      <div class="text-label">Source Trace</div>
      <div class="code-block">
        ${formatCodeTraceHtml(snippet)}
      </div>
    </div>

    <div class="causes-grid">
      <div>
        <div class="text-label">Possible Causes</div>
        <div style="font-size: 14px; color: var(--color-text-primary);">
          ${possibleCauses.map(c => `• ${escapeHtml(c)}`).join('<br>')}
        </div>
      </div>
      <div>
        <div class="text-label">Suggested Fix</div>
        <div style="background:light-dark(oklch(96% 0.01 285), oklch(22% 0.01 285));padding:16px;border-radius:8px;font-family:monospace;font-size:13px;color:var(--color-text-primary);border:1px solid var(--color-border);">
          <div style="color:var(--color-text-secondary);margin-bottom:8px;">${escapeHtml(fixComment)}</div>
          ${fixCode.includes('{%') || fixCode.includes('{{')
            ? `<span>${escapeHtml(fixCode)}</span>`
            : `<span style="color:oklch(70% 0.12 190);">${escapeHtml(fixCode.split('(')[0])}</span>${escapeHtml(fixCode.substring(fixCode.indexOf('(')))}`
          }
        </div>
      </div>
    </div>

    ${renderContextHtml(renderContext)}

    ${formatStackTraceHtml(originalError, isProduction)}
  </div>

  <div style="padding:16px 32px;background:light-dark(oklch(96% 0.01 285), oklch(16% 0.01 285));border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <div style="font-size:12px;color:var(--color-text-secondary);">
      Environment: <span style="font-weight:600;color:var(--color-text-primary);">${isProduction ? 'Production' : 'Development'}</span>
    </div>
    <div style="display:flex;gap:12px;">
      <a href="${templatePath ? 'vscode://file/' + escapeHtml(templatePath) + ':' + getDisplayLine() + ':' + getDisplayCol() : '#'}" class="btn btn-solid" ${!templatePath ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path>
          <path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"></path>
          <path d="M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"></path>
          <rect x="15" y="6" width="6" height="12" rx="2"></rect>
        </svg>
        Open in IDE
      </a>
    </div>
  </div>
</div>
`;
};

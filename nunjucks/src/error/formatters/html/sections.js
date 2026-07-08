import { escapeHtml, highlightHtml } from './highlight.js';
import { resolveIdeLink } from '../../constants/ide-links.js';

export const formatCodeTraceHtml = (snippet) => {
  if (!snippet) return '<div class="code-line"><span class="line-number">&nbsp;</span><span class="code-content">Source not available</span></div>';

  const lines = snippet.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    const isError = trimmed.startsWith('>>>');
    const content = isError ? trimmed.replace(/^>>>\s*/, '') : trimmed;
    const colonIdx = content.indexOf(':');
    const lineNum = colonIdx > 0 ? content.substring(0, colonIdx) : '';
    const code = colonIdx > 0 ? content.substring(colonIdx + 1).trim() : content;
    return `<div class="code-line${isError ? ' is-error' : ''}"><span class="line-number">${lineNum || '&nbsp;'}</span><span class="code-content">${highlightHtml(code)}</span></div>`;
  }).join('');
};

export const renderContextHtml = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx);
  if (keys.length === 0) return '';

  const rows = keys.map((k) => {
    const raw = ctx[k];
    const val = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return `<div class="ctx-row" style="display:flex;gap:12px;padding:6px 12px;border-bottom:1px solid var(--color-border);font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;"><dt style="color:oklch(70% 0.15 190);min-width:120px;flex-shrink:0;">${escapeHtml(k)}</dt><dd style="margin:0;color:var(--color-code-text);word-break:break-all;">${escapeHtml(val)}</dd></div>`;
  }).join('');

  return `
    <section class="render-context" style="margin-bottom: 32px;" aria-labelledby="h-ctx">
      <h2 id="h-ctx" class="text-label">Render Context</h2>
      <dl style="margin:0;background:var(--color-code-bg);border-radius:8px;overflow:hidden;border:1px solid var(--color-border);">${rows}</dl>
    </section>`;
};

const normalizePath = (p) => p.replace(/^file:\/\/+/, '');

const PROJECT_ROOT = process.cwd();

const shortenPath = (path) => {
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedRoot = PROJECT_ROOT.replace(/\\/g, '/');

  const parts = normalizedPath.split('/').filter(Boolean);
  const rootDirName = normalizedRoot.split('/').pop();

  // Find 'users' or 'home' index
  const privateIdx = parts.findIndex(p => 
    p.toLowerCase() === 'users' || p.toLowerCase() === 'home'
  );

  if (privateIdx !== -1) {
    // Find project root directory name in path (last part of PROJECT_ROOT)
    const projectIdx = parts.findIndex(p => p === rootDirName);

    if (projectIdx !== -1) {
      // Show: drive/Users/.../[from project root]
      const before = parts.slice(0, privateIdx + 1);
      const after = parts.slice(projectIdx);
      return [...before, '...', ...after].join('/');
    }

    // No project root found, just show Users/.../rest
    const before = parts.slice(0, privateIdx + 1);
    const after = parts.slice(privateIdx + 2);
    return [...before, '...', ...after].join('/');
  }

  return normalizedPath;
};

const linkifyFrame = (frame, ide) => {
  let s = escapeHtml(frame);
  s = s.replace(/\(([^()]+):(\d+):(\d+)\)$/, (match, p, l, c) => {
    if (/^native$/.test(p.trim()) || /^&lt;/.test(p) || !/[\\/]/.test(p)) return match;
    const norm = normalizePath(p);
    const display = shortenPath(norm);
    return `(<a href="${resolveIdeLink(ide, norm, l, c)}" class="stack-link">${display}:${l}:${c}</a>)`;
  });
  return s;
};

export const formatStackTraceHtml = (originalError, isProduction = false, ide = 'vscode') => {
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

  const VISIBLE_COUNT = 5;
  const totalHidden = Math.max(0, linesToShow.length - VISIBLE_COUNT);

  const allRows = linesToShow.map((line, index) => {
    const isHidden = index >= VISIBLE_COUNT;
    return `<div class="stack-row${isHidden ? ' is-collapsed' : ''}"><code class="stack-code">${linkifyFrame(line.trim(), ide)}</code></div>`;
  }).join('');

  const toggleBtn = totalHidden > 0
    ? `<button class="stack-toggle-btn" id="btn-toggle-stack" onclick="toggleStack()">Show ${totalHidden} more lines...</button>`
    : '';

  return `
    <section class="stack-trace" style="margin-bottom:32px;" aria-labelledby="h-stack">
      <h2 id="h-stack" class="text-label">Stack Trace</h2>
      <div class="stack-container" id="stack-container">
        <div class="stack-content">${allRows}</div>
        ${toggleBtn}
      </div>
    </section>
  `;
};

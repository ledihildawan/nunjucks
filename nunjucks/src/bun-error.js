let SQLite;
try {
  SQLite = require('bun:sqlite');
} catch (e) {
  SQLite = null;
}

let picocolors;
try {
  picocolors = require('picocolors');
} catch (e) {
  picocolors = null;
}

const pc = picocolors || {
  red: (s) => s,
  bold: (s) => s,
  dim: (s) => s,
  cyan: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  magenta: (s) => s,
  bgRed: (s) => s,
  white: (s) => s,
};

function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export class NunjucksError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'NunjucksError';
    this.templateName = meta.templateName || 'unknown';
    this.templateId = meta.templateId || null;
    this.line = meta.line || null;
    this.col = meta.col || null;
    this.snippet = meta.snippet || null;
    this.includeChain = meta.includeChain || null;
    this.isProduction = meta.isProduction || false;
  }

  getSnippet(sourceLines, centerLine, context = 3) {
    if (!sourceLines || !Array.isArray(sourceLines)) {
      return null;
    }
    const start = Math.max(0, centerLine - context - 1);
    const end = Math.min(sourceLines.length, centerLine + context);
    let lines = sourceLines.slice(start, end).map((line, i) => {
      const lineNum = start + i + 1;
      const isError = lineNum === centerLine;
      const prefix = isError ? '>>> ' : '    ';
      const content = line || ' ';
      return `${prefix}${lineNum}: ${content}`;
    });
    while (lines.length > 1 && lines[lines.length - 1].trim() === `${lines[lines.length - 1].split(':')[0].trim()}:`) {
      lines.pop();
    }
    return lines.join('\n');
  }

  toConsoleString() {
    if (this.isProduction) {
      return `${pc.bgRed(pc.white(' ERROR '))} ${pc.dim('[Nunjucks]')} Template error\n${pc.dim('  Error ID:')} ${pc.yellow(this.templateId || 'unknown')}`;
    }

    const lines = [];

    lines.push(`${pc.red('Nunjucks Error')} ${pc.dim('in')} ${pc.white(this.templateName)}`);

    if (this.templateId) {
      lines.push(`${pc.dim('  ID:')} ${pc.yellow(this.templateId)}`);
    }

    if (this.snippet) {
      lines.push('');
      lines.push(this.snippet);
    }

    lines.push('');
    lines.push(pc.dim('Trace:'));
    lines.push(this.message);

    return lines.join('\n');
  }

  toHtmlString() {
    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (this.isProduction) {
      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 60px auto; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center;">
          <div style="width: 48px; height: 48px; margin: 0 auto 16px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <span style="color: #dc2626; font-size: 24px;">!</span>
          </div>
          <div style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">Template Error</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 16px;">Error ID: <code style="background: #f5f5f5; padding: 2px 8px; border-radius: 4px;">${this.templateId || 'unknown'}</code></div>
          <div style="font-size: 13px; color: #999;">Contact support with this error ID.</div>
        </div>
      `;
    }

    let html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 40px auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); overflow: hidden;">
        <div style="padding: 20px 24px; background: #fef2f2; border-bottom: 1px solid #fecaca;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 18px;">!</span>
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Nunjucks Error</div>
              <div style="font-size: 13px; color: #666;">${escapeHtml(this.templateName)}</div>
            </div>
          </div>
        </div>
        <div style="padding: 24px;">
    `;

    if (this.templateId) {
      html += `<div style="margin-bottom: 16px; font-size: 13px;"><span style="color: #666;">ID:</span> <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">${this.templateId}</code></div>`;
    }

    if (this.snippet) {
      const snippetLines = this.snippet.split('\n').map(line => {
        const isError = line.trim().startsWith('>>>');
        if (isError) {
          return `<div style="background: #fef2f2; color: #dc2626; padding: 8px 12px; border-left: 3px solid #dc2626; font-family: monospace; font-size: 13px;">${escapeHtml(line.replace('>>>', '').trim())}</div>`;
        }
        return `<div style="color: #333; padding: 4px 12px; font-family: monospace; font-size: 13px;">${escapeHtml(line)}</div>`;
      }).join('');

      html += `<div style="margin-bottom: 16px; background: #f9f9f9; border-radius: 8px; overflow: hidden;">${snippetLines}</div>`;
    }

    html += `
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Trace:</div>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 13px; white-space: pre-wrap; color: #333;">
        ${escapeHtml(this.message)}
      </div>
    `;

    html += `
        </div>
      </div>
    `;

    return html;
  }

  toString() {
    return this.toConsoleString();
  }
}

export class ErrorFormatter {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.db = null;
    this.mode = options.mode || 'development';
    this.logger = options.logger || console;
  }

  init() {
    if (this.db) return;
    if (SQLite && this.dbPath) {
      this.db = new SQLite.Database(this.dbPath);
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  getMode() {
    return this.mode;
  }

  setMode(mode) {
    this.mode = mode;
  }

  getTemplateInfo(name) {
    if (!this.db) return null;
    try {
      const template = this.db.prepare(
        'SELECT uuid, source_content FROM _compiled_templates WHERE name = ?'
      ).get(name);
      return template || null;
    } catch (e) {
      return null;
    }
  }

  hasTables() {
    if (!this.db) return false;
    try {
      this.db.prepare('SELECT 1 FROM _compiled_templates').get();
      return true;
    } catch (e) {
      return false;
    }
  }

  getSourceLines(sourceContent) {
    if (!sourceContent) return null;
    return sourceContent.split('\n');
  }

  extractErrorTemplateName(message) {
    if (!message) return null;
    const match = message.match(/Template render error: \(([^)]+)\)/);
    return match ? match[1] : null;
  }

  extractLineInfo(message) {
    if (!message) return { line: null, col: null };
    const lineMatch = message.match(/\[Line (\d+)(?:, Column (\d+))?\]/i);
    if (lineMatch) {
      return { line: parseInt(lineMatch[1], 10), col: lineMatch[2] ? parseInt(lineMatch[2], 10) : null };
    }
    return { line: null, col: null };
  }

  async formatError(error, templateName, includeChain = null) {
    this.init();

    const isProd = this.mode === 'production';
    const hasTables = this.hasTables();

    const actualTemplateName = this.extractErrorTemplateName(error.message) || templateName;
    const templateInfo = hasTables ? this.getTemplateInfo(actualTemplateName) : null;
    const templateId = templateInfo?.uuid || null;

    const lineFromError = error.lineno;
    const colFromError = error.colno;
    const { line: lineFromMsg, col: colFromMsg } = this.extractLineInfo(error.message);
    const line = lineFromError || lineFromMsg;
    const col = colFromError || colFromMsg;
    let snippet = null;

    const effectiveChain = includeChain || error._includeChain || null;

    const chainForDisplay = effectiveChain ? (Array.isArray(effectiveChain) ? effectiveChain : [effectiveChain]) : null;

    if (templateInfo?.source_content && line) {
      const sourceLines = this.getSourceLines(templateInfo.source_content);
      const errorMeta = { templateName: actualTemplateName, templateId, line, col, snippet: null, includeChain: effectiveChain, isProduction: false };
      const tempError = new NunjucksError(error.message, errorMeta);
      snippet = tempError.getSnippet(sourceLines, line, 3);
    } else if (line) {
      snippet = `>>> ${line}: [source not available]`;
    }

    const meta = {
      templateName: actualTemplateName,
      templateId,
      line,
      col,
      snippet,
      includeChain: chainForDisplay,
      isProduction: isProd
    };

    if (isProd && hasTables) {
      this.logger.error({
        type: 'NUNJUCKS_RENDER_ERROR',
        templateName: actualTemplateName,
        templateId,
        line,
        col,
        message: error.message,
        includeChain: chainForDisplay
      });
    }

    return new NunjucksError(error.message, meta);
  }
}

export function createErrorFormatter(dbPath, options) {
  return new ErrorFormatter(dbPath, options);
}

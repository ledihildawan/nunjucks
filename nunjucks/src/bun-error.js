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
      return `${pc.bgRed('[ERROR]')} Template Rendering Failed\n${pc.dim('Reference ID:')} ${pc.yellow(this.templateId || 'unknown')}`;
    }

    const raw = this.message;
    const errorText = raw.split('\n').find(l => l.match(/^  Error:/i))?.replace(/^  Error:\s*/i, '') || raw.split('\n').pop()?.trim() || raw;
    const errorType = 'TemplateSyntaxError';

    const locationFile = this.includeChain && this.includeChain.length > 0
      ? `${this.templateName} (included from ${this.includeChain[0].parentTmpl}:${this.includeChain[0].parentLineno})`
      : this.templateName;

    const traceLines = this.snippet ? this.snippet.split('\n').map(l => l.trim()) : [];

    const lines = [];

    lines.push(`${pc.bgRed('[ERROR]')} ${pc.bold('Template Rendering Failed')}`);
    lines.push(pc.dim('─'.repeat(60)));

    lines.push(`${pc.bold('Message:')} ${errorText}`);

    lines.push(`${pc.bold('Reason:')} ${errorText.includes('undefined') ? 'Function is undefined or falsey' : errorText}`);
    lines.push(`${pc.bold('Code:')} ${pc.yellow(errorType)}`);

    lines.push('');
    lines.push(`${pc.bold('Location:')}`);
    lines.push(`  ${pc.bold('File:')} ${locationFile}`);
    lines.push(`  ${pc.bold('Line:')} ${this.line || 'unknown'}`);

    if (traceLines.length > 0) {
      lines.push('');
      lines.push(`${pc.bold('Traceback:')}`);
      for (const line of traceLines) {
        if (line.startsWith('>>>')) {
          lines.push(pc.red(line));
        } else {
          lines.push(pc.dim(line));
        }
      }
    }

    lines.push('');
    lines.push(`${pc.dim('Reference ID:')} ${this.templateId || 'unknown'}`);

    return lines.join('\n');
  }

  toHtmlString() {
    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (this.isProduction) {
      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); text-align: center;">
          <div style="width: 56px; height: 56px; margin: 0 auto 20px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <span style="color: #dc2626; font-size: 28px; font-weight: bold;">!</span>
          </div>
          <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">Template Rendering Failed</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 20px;">Reference ID: <code style="background: #f5f5f5; padding: 4px 12px; border-radius: 6px; font-family: monospace;">${this.templateId || 'unknown'}</code></div>
          <div style="font-size: 13px; color: #999;">Contact support with this reference ID.</div>
        </div>
      `;
    }

    const raw = this.message;
    const errorText = raw.split('\n').find(l => l.match(/^  Error:/i))?.replace(/^  Error:\s*/i, '') || raw.split('\n').pop()?.trim() || raw;
    const errorType = 'TemplateSyntaxError';

    const locationFile = this.includeChain && this.includeChain.length > 0
      ? `${escapeHtml(this.templateName)} (included from ${escapeHtml(this.includeChain[0].parentTmpl)}:${this.includeChain[0].parentLineno})`
      : escapeHtml(this.templateName);

    let snippetHtml = '';
    if (this.snippet) {
      const traceLines = this.snippet.split('\n');
      snippetHtml = traceLines.map(line => {
        const isError = line.trim().startsWith('>>>');
        if (isError) {
          return `<div style="background: #fef2f2; padding: 12px 16px; font-family: monospace; font-size: 13px; color: #dc2626; border-left: 4px solid #dc2626;">${escapeHtml(line.replace('>>>', '').trim())}</div>`;
        }
        return `<div style="padding: 4px 16px; font-family: monospace; font-size: 13px; color: #666;">${escapeHtml(line)}</div>`;
      }).join('');
    }

    let html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 40px auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden;">
        <div style="padding: 24px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px; font-weight: bold;">!</span>
            </div>
            <div style="color: white;">
              <div style="font-size: 20px; font-weight: 700;">Template Rendering Failed</div>
            </div>
          </div>
        </div>
        <div style="padding: 24px;">
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Message</div>
            <div style="font-size: 15px; color: #1a1a1a;">${escapeHtml(errorText)}</div>
          </div>
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Reason</div>
            <div style="font-size: 15px; color: #1a1a1a;">${errorText.includes('undefined') ? 'Function is undefined or falsey' : escapeHtml(errorText)}</div>
          </div>
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Code</div>
            <div style="font-size: 14px;"><code style="background: #fef2f2; color: #dc2626; padding: 4px 10px; border-radius: 4px; font-family: monospace;">${errorType}</code></div>
          </div>
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">Location</div>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 12px 16px;">
              <div style="margin-bottom: 4px;"><span style="color: #666;">File:</span> <code style="font-family: monospace;">${locationFile}</code></div>
              <div><span style="color: #666;">Line:</span> <strong>${this.line || 'unknown'}</strong></div>
            </div>
          </div>
    `;

    if (snippetHtml) {
      html += `
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">Traceback</div>
            <div style="background: #1e1e1e; border-radius: 8px; overflow: hidden;">${snippetHtml}</div>
          </div>
      `;
    }

    html += `
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
            <div style="font-size: 12px; color: #999;">Reference ID: <code style="background: #f5f5f5; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${this.templateId || 'unknown'}</code></div>
          </div>
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
    const includedMatch = message.match(/\(included from [^:]+:(\d+)\)/);
    if (includedMatch) {
      return { line: parseInt(includedMatch[1], 10), col: null };
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

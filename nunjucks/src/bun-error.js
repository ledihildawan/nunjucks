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
    return sourceLines.slice(start, end).map((line, i) => {
      const lineNum = start + i + 1;
      const isError = lineNum === centerLine;
      const prefix = isError ? '>>> ' : '    ';
      const content = line || ' ';
      return `${prefix}${lineNum}: ${content}`;
    }).join('\n');
  }

  toConsoleString() {
    if (this.isProduction) {
      return `${pc.bgRed(pc.white(' ERROR '))} [Nunjucks] Render failed at ID: ${pc.bold(this.templateId || 'unknown')}`;
    }

    const lines = [];

    lines.push(`${pc.bgRed(pc.white(' ERROR '))} ${pc.red('Nunjucks Runtime Error')}`);
    lines.push('');

    const location = this.templateName + (this.line ? `:${pc.cyan(this.line)}${this.col ? ':' + pc.cyan(this.col) : ''}` : '');
    lines.push(`${pc.bold('→ Location:')} ${pc.white(location)}`);

    if (this.templateId) {
      lines.push(`${pc.dim('  Template ID:')} ${pc.yellow(this.templateId)}`);
    }

    if (this.includeChain && this.includeChain.length > 0) {
      lines.push(`${pc.bold('→ Include chain:')}`);
      for (const chain of this.includeChain) {
        lines.push(`  ${pc.yellow('↳')} ${chain.parentTmpl} ${pc.dim('at line')} ${pc.cyan(chain.parentLineno)}`);
      }
    }

    if (this.snippet) {
      lines.push('');
      lines.push(`${pc.dim('─'.repeat(50))}`);
      lines.push(this.snippet);
      lines.push(`${pc.dim('─'.repeat(50))}`);
    }

    lines.push('');
    lines.push(`${pc.red('✖ Message:')} ${this.message}`);

    return lines.join('\n');
  }

  toHtmlString() {
    if (this.isProduction) {
      return `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 32px; height: 32px; background: #dc3545; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 18px;">!</span>
            </div>
            <div>
              <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">Template Error</div>
              <div style="font-size: 13px; color: #666;">ID: ${this.templateId || 'unknown'}</div>
            </div>
          </div>
          <div style="font-size: 14px; color: #666;">An error occurred while rendering this template. Check server logs for details.</div>
        </div>
      `;
    }

    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const errorParts = this.message.split('\n').filter(l => l.trim());

    let html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 24px; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
          <div style="width: 36px; height: 36px; background: #dc3545; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span style="color: white; font-weight: bold; font-size: 20px;">✕</span>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">Nunjucks Error</div>
            <div style="font-size: 13px; color: #666;">${escapeHtml(this.templateName)}${this.line ? ` <span style="color: #999;">line ${this.line}${this.col ? ', col ' + this.col : ''}</span>` : ''}</div>
          </div>
        </div>
    `;

    if (this.templateId) {
      html += `
        <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 4px;">Template ID</div>
          <div style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px; color: #333;">${this.templateId}</div>
        </div>
      `;
    }

    if (this.includeChain && this.includeChain.length > 0) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 8px;">Include Chain</div>
          <div style="padding-left: 0;">
      `;
      for (const chain of this.includeChain) {
        html += `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="color: #dc3545;">↳</span>
              <span style="color: #333;">${escapeHtml(chain.parentTmpl)}</span>
              <span style="color: #999; font-size: 13px;">at line ${chain.parentLineno}</span>
            </div>
        `;
      }
      html += `
          </div>
        </div>
      `;
    }

    if (this.snippet) {
      const snippetLines = this.snippet.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('>>>')) {
          return `<div style="background: #fff5f5; color: #dc3545; padding: 8px 16px; border-left: 4px solid #dc3545; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px; font-weight: 600;">${escapeHtml(line)}</div>`;
        }
        return `<div style="color: #555; padding: 4px 16px; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px;">${escapeHtml(line)}</div>`;
      }).join('');

      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 8px;">Code</div>
          <div style="background: #f8f9fa; border-radius: 6px; overflow: hidden; border: 1px solid #e5e5e5;">${snippetLines}</div>
        </div>
      `;
    }

    html += `
      <div style="background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px 16px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #dc3545; margin-bottom: 4px;">Error</div>
        <div style="font-size: 14px; color: #721c24; font-family: 'SF Mono', Monaco, Consolas, monospace;">${escapeHtml(errorParts[0] || this.message)}</div>
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

  async formatError(error, templateName, includeChain = null) {
    this.init();

    const isProd = this.mode === 'production';
    const hasTables = this.hasTables();
    const templateInfo = hasTables ? this.getTemplateInfo(templateName) : null;
    const templateId = templateInfo?.uuid || null;

    let line = error.lineno;
    let col = error.colno;
    let snippet = null;

    if (templateInfo?.source_content && line) {
      const sourceLines = this.getSourceLines(templateInfo.source_content);
      const errorMeta = { templateName, templateId, line, col, snippet: null, includeChain, isProduction: false };
      const tempError = new NunjucksError(error.message, errorMeta);
      snippet = tempError.getSnippet(sourceLines, line, 3);
    }

    const meta = {
      templateName,
      templateId,
      line,
      col,
      snippet,
      includeChain,
      isProduction: isProd
    };

    if (isProd && hasTables) {
      this.logger.error({
        type: 'NUNJUCKS_RENDER_ERROR',
        templateName,
        templateId,
        line,
        col,
        message: error.message,
        includeChain
      });
    }

    return new NunjucksError(error.message, meta);
  }
}

export function createErrorFormatter(dbPath, options) {
  return new ErrorFormatter(dbPath, options);
}

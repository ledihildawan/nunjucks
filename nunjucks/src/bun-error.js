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
        <div style="font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; max-width: 800px;">
          <div style="background: #f85149; color: white; padding: 4px 12px; border-radius: 4px; display: inline-block; margin-bottom: 16px; font-weight: bold;">
            ERROR
          </div>
          <div style="color: #f85149; font-size: 16px; margin-bottom: 12px;">
            [Nunjucks] Render failed
          </div>
          <div style="color: #6a9955; font-size: 14px;">
            ID: <code style="background: #2d2d2d; padding: 2px 6px; border-radius: 3px;">${this.templateId || 'unknown'}</code>
          </div>
        </div>
      `;
    }

    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    let html = `
      <div style="font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; max-width: 900px; white-space: pre-wrap;">
        <div style="margin-bottom: 16px;">
          <span style="background: #f85149; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; margin-right: 12px;">ERROR</span>
          <span style="color: #f85149; font-size: 16px;">Nunjucks Runtime Error</span>
        </div>

        <div style="margin-bottom: 12px; padding: 12px; background: #2d2d2d; border-radius: 4px; border-left: 3px solid #569cd6;">
          <div style="color: #9cdcfe; margin-bottom: 8px;">
            <span style="color: #6a9955;">→</span> Location:
            <span style="color: #ce9178;">"${escapeHtml(this.templateName)}"</span>
            ${this.line ? `<span style="color: #b5cea8;">:${this.line}${this.col ? ':' + this.col : ''}</span>` : ''}
          </div>
          ${this.templateId ? `
          <div style="color: #6a9955; font-size: 13px;">
            Template ID: <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px; color: #ce9178;">${this.templateId}</code>
          </div>
          ` : ''}
        </div>
    `;

    if (this.includeChain && this.includeChain.length > 0) {
      html += `
        <div style="margin-bottom: 12px; padding: 12px; background: #2d2d2d; border-radius: 4px; border-left: 3px solid #dcdcaa;">
          <div style="color: #9cdcfe; margin-bottom: 8px;">
            <span style="color: #6a9955;">→</span> Include Chain:
          </div>
      `;
      for (const chain of this.includeChain) {
        html += `
          <div style="color: #ce9178; margin-left: 16px; margin-bottom: 4px;">
            <span style="color: #d7ba7d;">↳</span> ${escapeHtml(chain.parentTmpl)}
            <span style="color: #6a9955;"> at line </span>
            <span style="color: #b5cea8;">${chain.parentLineno}</span>
          </div>
        `;
      }
      html += `</div>`;
    }

    if (this.snippet) {
      const snippetLines = this.snippet.split('\n').map(line => {
        if (line.startsWith('>>>')) {
          return `<div style="background: #f8514922; color: #f85149; padding: 4px 12px; border-left: 4px solid #f85149; font-weight: bold;">${escapeHtml(line)}</div>`;
        }
        return `<div style="color: #9cdcfe; padding: 4px 12px;">${escapeHtml(line)}</div>`;
      }).join('');

      html += `
        <div style="margin-bottom: 12px; background: #2d2d2d; border-radius: 4px; border-left: 4px solid #569cd6; overflow: hidden;">
          <div style="color: #6a9955; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #3e3e3e;">Code snippet:</div>
          <div style="font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5;">${snippetLines}</div>
        </div>
      `;
    }

    html += `
      <div style="margin-top: 16px; padding: 12px; background: #f8514922; border-radius: 4px; border-left: 3px solid #f85149;">
        <div style="color: #f85149; font-size: 14px; white-space: pre-wrap;">
          <span style="color: #d7ba7d;">✖</span> ${escapeHtml(this.message)}
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

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
      return `${pc.bgRed(pc.white(' ERROR '))} ${pc.dim('[Nunjucks]')} Render failed\n${pc.dim('  Error ID:')} ${pc.yellow(this.templateId || 'unknown')}\n${pc.dim('  Reference this ID when contacting support.')}`;
    }

    const thick = pc.dim('─'.repeat(50));
    const lines = [];

    lines.push('');
    lines.push(`${pc.red('┌')}${thick}${pc.red('┐')}`);
    lines.push(`${pc.red('│')} ${pc.red(pc.bold('Nunjucks Error'))}${' '.repeat(50 - 15)}${pc.red('│')}`);
    lines.push(`${pc.red('└')}${thick}${pc.red('┘')}`);
    lines.push('');

    lines.push(`  ${pc.white(pc.bold(this.templateName))} ${pc.dim('┃ line')} ${pc.cyan(this.line)}`);
    lines.push('');

    if (this.templateId) {
      lines.push(`  ${pc.dim('Template ID:')} ${pc.yellow(this.templateId)}`);
      lines.push('');
    }

    if (this.snippet) {
      lines.push(`  ${pc.dim('Code:')}`);
      lines.push('  ' + pc.dim('┄'.repeat(46)));
      for (const snippetLine of this.snippet.split('\n')) {
        if (snippetLine.includes('>>>')) {
          const [,, ...rest] = snippetLine.split(' ');
          lines.push(`  ${pc.red('>>>')} ${rest.join(' ')}`);
        } else {
          lines.push(`  ${pc.dim(snippetLine)}`);
        }
      }
      lines.push('  ' + pc.dim('┄'.repeat(46)));
      lines.push('');
    }

    if (this.includeChain && this.includeChain.length > 0) {
      lines.push(`  ${pc.dim('Include chain:')}`);
      for (const chain of this.includeChain) {
        lines.push(`    ${pc.red('↳')} ${pc.yellow(chain.parentTmpl)} ${pc.dim('at line')} ${pc.cyan(chain.parentLineno)}`);
      }
      lines.push('');
    }

    lines.push(`  ${pc.red(pc.bold('Error:'))}`);
    lines.push(`  ${this.message}`);

    lines.push('');

    return lines.join('\n');
  }

  toHtmlString() {
    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (this.isProduction) {
      return `
        <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; background: #1e1e1e; border: 1px solid #333; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; background: #dc3545; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(220,53,69,0.4);">
              <span style="color: white; font-weight: bold; font-size: 24px;">!</span>
            </div>
            <div>
              <div style="font-size: 20px; font-weight: 600; color: #e0e0e0;">Template Error</div>
              <div style="font-size: 13px; color: #888; margin-top: 4px;">Reference ID for support: <code style="background: #2d2d2d; padding: 2px 8px; border-radius: 4px; color: #569cd6;">${this.templateId || 'unknown'}</code></div>
            </div>
          </div>
          <div style="font-size: 14px; color: #888; background: #2d2d2d; padding: 16px; border-radius: 6px; border-left: 3px solid #569cd6;">
            An error occurred while rendering this template. Please contact support with the error ID above.
          </div>
        </div>
      `;
    }

    let html = `
      <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; background: #1e1e1e; border: 1px solid #333; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 16px 24px; display: flex; align-items: center; gap: 12px;">
          <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: bold; font-size: 18px;">!</span>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 600; color: white;">Nunjucks Error</div>
            <div style="font-size: 13px; color: rgba(255,255,255,0.8);">${escapeHtml(this.templateName)} <span style="background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px;">line ${this.line}</span></div>
          </div>
        </div>
        <div style="padding: 24px;">
    `;

    if (this.templateId) {
      html += `
        <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <div style="flex: 1; padding: 12px 16px; background: #2d2d2d; border-radius: 6px; border: 1px solid #3d3d3d;">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px;">Template ID</div>
            <div style="font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 14px; color: #569cd6;">${this.templateId}</div>
          </div>
          <button onclick="navigator.clipboard.writeText('${this.templateId}')" style="padding: 10px 16px; background: #0e639c; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 13px;">Copy ID</button>
        </div>
      `;
    }

    if (this.snippet) {
      const snippetLines = this.snippet.split('\n').map(line => {
        const trimmed = line.trim();
        const isError = trimmed.startsWith('>>>');
        const isMiddle = line.match(/^\s+\d+:/);

        if (isError) {
          return `<div style="background: rgba(220, 53, 69, 0.15); color: #f48771; padding: 10px 16px; border-left: 3px solid #dc3545; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; font-weight: 600;">${escapeHtml(line.replace('>>>', '').trim())}</div>`;
        }
        return `<div style="color: #9cdcfe; padding: 4px 16px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; background: ${isMiddle ? '#252526' : 'transparent'};">${escapeHtml(line)}</div>`;
      }).join('');

      html += `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px;">Code</div>
          <div style="background: #252526; border-radius: 6px; overflow: hidden; border: 1px solid #3d3d3d;">${snippetLines}</div>
        </div>
      `;
    }

    if (this.includeChain && this.includeChain.length > 0) {
      html += `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px;">Include Chain</div>
          <div style="background: #2d2d2d; border-radius: 6px; padding: 12px 16px; border: 1px solid #3d3d3d;">
      `;
      for (const chain of this.includeChain) {
        html += `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="color: #dc3545; font-size: 16px;">↳</span>
              <span style="color: #e0e0e0; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;">${escapeHtml(chain.parentTmpl)}</span>
              <span style="color: #858585; font-size: 13px;">at line <span style="color: #569cd6;">${chain.parentLineno}</span></span>
            </div>
        `;
      }
      html += `
          </div>
        </div>
      `;
    }

    html += `
      <div style="background: rgba(220, 53, 69, 0.1); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 6px; padding: 16px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #f48771; margin-bottom: 8px;">Error</div>
        <div style="font-size: 14px; color: #e0e0e0; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(this.message)}</div>
      </div>
    `;

    html += `
        </div>
        <div style="background: #2d2d2d; padding: 12px 24px; border-top: 1px solid #3d3d3d; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: #666;">nunjucks</span>
          <span style="font-size: 12px; color: #666;">${this.templateId ? 'ID: ' + this.templateId.substring(0, 8) + '...' : ''}</span>
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

  async formatError(error, templateName, includeChain = null) {
    this.init();

    const isProd = this.mode === 'production';
    const hasTables = this.hasTables();

    const actualTemplateName = this.extractErrorTemplateName(error.message) || templateName;
    const templateInfo = hasTables ? this.getTemplateInfo(actualTemplateName) : null;
    const templateId = templateInfo?.uuid || null;

    const line = error.lineno;
    const col = error.colno;
    let snippet = null;

    const effectiveChain = includeChain || error._includeChain || null;

    const chainForDisplay = effectiveChain ? (Array.isArray(effectiveChain) ? effectiveChain : [effectiveChain]) : null;

    if (templateInfo?.source_content && line) {
      const sourceLines = this.getSourceLines(templateInfo.source_content);
      const errorMeta = { templateName: actualTemplateName, templateId, line, col, snippet: null, includeChain: effectiveChain, isProduction: false };
      const tempError = new NunjucksError(error.message, errorMeta);
      snippet = tempError.getSnippet(sourceLines, line, 3);
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

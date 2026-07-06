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
};

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

  toVisualString() {
    if (this.isProduction) {
      return `[Nunjucks Error] Render failed at ID: ${this.templateId || 'unknown'}`;
    }

    let output = '';

    output += `${pc.red('✖ Nunjucks Runtime Error')}\n`;

    const location = this.templateName;
    if (this.line && this.col) {
      output += `${pc.bold('Location:')} ${location}:${pc.cyan(this.line + ':' + this.col)}\n`;
    } else if (this.line) {
      output += `${pc.bold('Location:')} ${location}:${pc.cyan(this.line)}\n`;
    } else {
      output += `${pc.bold('Location:')} ${location}\n`;
    }

    if (this.templateId) {
      output += `${pc.dim('Template ID:')} ${this.templateId}\n`;
    }

    if (this.includeChain) {
      output += `${pc.dim('Include chain:')}\n`;
      for (const chain of this.includeChain) {
        output += `  ${pc.yellow('↳')} ${chain.parentTmpl} at line ${chain.parentLineno}\n`;
      }
    }

    if (this.snippet) {
      output += `${pc.dim('--------------------------------')}\n`;
      output += this.snippet + '\n';
      output += `${pc.dim('--------------------------------')}\n`;
    }

    output += `${pc.red(this.message)}`;

    return output;
  }

  toSafeString() {
    if (!this.isProduction) {
      return this.toVisualString();
    }
    return `[Nunjucks Error] Render failed at ID: ${this.templateId || 'unknown'}`;
  }

  toString() {
    return this.toSafeString();
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

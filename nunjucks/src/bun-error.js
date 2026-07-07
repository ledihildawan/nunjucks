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

function classifyError(rawMessage) {
  if (!rawMessage) return null;

  if (/attempted to output null or undefined value/i.test(rawMessage)) {
    return {
      category: 'undefined_variable',
      undefinedName: null,
      causes: [
        'Variable not passed in render context',
        'Using undefined variable name',
        'Typo in variable name'
      ],
      fixCode: "{{ variable|default('default_value') }}",
      fixComment: '// Add default filter or pass variable in context'
    };
  }

  if (/Unable to call `([^`]+)`.*which is undefined/i.test(rawMessage)) {
    const fnName = extractUndefinedName(rawMessage);
    return {
      category: 'undefined_function',
      undefinedName: fnName,
      causes: [
        `Function '${fnName}' not registered with env.addGlobal()`,
        `Filter '${fnName}' not registered with env.addFilter()`,
        'Misspelled function or filter name'
      ],
      fixCode: `env.addGlobal('${fnName}', callback)`,
      fixComment: `// Register the missing function '${fnName}'`
    };
  }

  if (/is not a function|is not defined/i.test(rawMessage)) {
    return {
      category: 'not_a_function',
      undefinedName: extractUndefinedName(rawMessage),
      causes: [
        'Calling a non-function value',
        'Variable contains wrong data type'
      ],
      fixCode: "// Check variable type before calling\nconsole.log(typeof variable)",
      fixComment: '// Verify the variable type'
    };
  }

  if (/Unexpected token|unexpected end|SyntaxError/i.test(rawMessage)) {
    return {
      category: 'syntax_error',
      undefinedName: null,
      causes: [
        'Missing closing tag ({{ endif }}, {% endfor %})',
        'Mismatched quotes or brackets'
      ],
      fixCode: "{% raw %}{{ expression }}{% endraw %}",
      fixComment: '// Use raw tag for literal content'
    };
  }

  if (/filter.*not found|invalid filter/i.test(rawMessage)) {
    const filterName = extractUndefinedName(rawMessage);
    return {
      category: 'undefined_filter',
      undefinedName: filterName,
      causes: [
        `Filter '${filterName}' not registered with env.addFilter()`,
        'Typo in filter name'
      ],
      fixCode: `env.addFilter('${filterName}', fn)`,
      fixComment: `// Register the missing filter '${filterName}'`
    };
  }

  if (/block.*not found|undefined block/i.test(rawMessage)) {
    return {
      category: 'undefined_block',
      undefinedName: null,
      causes: [
        'Extending template without block definition',
        'Incorrect block name'
      ],
      fixCode: "{% block content %}{% endblock %}",
      fixComment: '// Define the missing block'
    };
  }

  return null;
}

function extractUndefinedName(message) {
  const callMatch = message.match(/Unable to call `([^`]+)`/);
  if (callMatch) return callMatch[1];

  const outputMatch = message.match(/attempted to output ([^ ]+)/i);
  if (outputMatch) return outputMatch[1];

  const notFoundMatch = message.match(/filter "([^"]+)" not found/i);
  if (notFoundMatch) return notFoundMatch[1];

  return null;
}

const ERROR_MAPPINGS = [
  {
    patterns: [/attempted to output null or undefined value/i],
    causes: ['Variable not passed in render context', 'Using undefined variable name', 'Typo in variable name']
  },
  {
    patterns: [/Unable to call.*which is undefined|cannot call.*undefined/i],
    causes: ['Function not registered with env.addGlobal()', 'Filter not registered with env.addFilter()', 'Misspelled function or filter name']
  },
  {
    patterns: [/is not a function|is not defined/i],
    causes: ['Calling a non-function value', 'Variable contains wrong data type']
  },
  {
    patterns: [/Unexpected token|unexpected end|SyntaxError/i],
    causes: ['Missing closing tag ({{ endif }}, {% endfor %})', 'Mismatched quotes or brackets']
  },
  {
    patterns: [/filter.*not found|invalid filter/i],
    causes: ['Filter not registered with env.addFilter()', 'Typo in filter name']
  },
  {
    patterns: [/block.*not found|undefined block/i],
    causes: ['Extending template without block definition', 'Incorrect block name']
  }
];

export class NunjucksError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = meta.errorName || 'NunjucksError';
    this.templateName = meta.templateName || 'unknown';
    this.templatePath = meta.templatePath || null;
    this.templateId = meta.templateId || null;
    this.line = meta.line ?? null;
    this.col = meta.col ?? null;
    this.snippet = meta.snippet || null;
    this.includeChain = meta.includeChain || null;
    this.isProduction = meta.isProduction || false;
    this.originalError = meta.originalError || null;
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
      return `${pc.bgRed('[ERROR]')} Template Rendering Failed\n${pc.dim('Check logs for details')}`;
    }

    const raw = this.message;
    const errorText = raw.split('\n').find(l => l.match(/^  Error:/i))?.replace(/^  Error:\s*/i, '') || raw.split('\n').pop()?.trim() || raw;
    const errorType = 'TemplateSyntaxError';

    const locationFile = this.includeChain && this.includeChain.length > 0
      ? `${this.templateName} ${pc.dim('(included from ' + this.includeChain[0].parentTmpl + ':' + this.includeChain[0].parentLineno + (this.includeChain[0].parentColno ? ':' + this.includeChain[0].parentColno : '') + ')')}`
      : this.templateName;

    const displayLine = this.line !== null && this.line !== undefined ? this.line : '?';
    const displayCol = this.col !== null && this.col !== undefined ? this.col : '?';

    const traceLines = this.snippet ? this.snippet.split('\n').map(l => l.trim()) : [];

    const lines = [];

    lines.push(`${pc.bgRed('[ERROR]')} ${pc.bold('Template Rendering Failed')}`);
    lines.push(pc.dim('─'.repeat(60)));

    const originalMsg = this.originalError?.message || '';
    const classified = classifyError(originalMsg);

    let displayMessage = errorText;
    if (classified) {
      if (classified.category === 'undefined_variable') {
        displayMessage = classified.undefinedName
          ? `Variable '${classified.undefinedName}' is undefined or null`
          : 'Variable is undefined or null';
      } else if (classified.category === 'undefined_function') {
        displayMessage = `Unable to call '${classified.undefinedName}', which is undefined or falsey`;
      }
    }
    lines.push(`${pc.bold('Message:')} ${displayMessage}`);

    lines.push('');
    lines.push(`${pc.bold('Error Type:')} ${pc.red(errorType)}`);
    lines.push(`${pc.bold('Position:')} Line ${displayLine}, Col ${displayCol}`);

    lines.push('');
    lines.push(`${pc.bold('Location:')} ${locationFile}`);

    if (traceLines.length > 0) {
      lines.push('');
      lines.push(`${pc.bold('Code Trace:')}`);
      for (const line of traceLines) {
        if (line.startsWith('>>>')) {
          lines.push(pc.red(line));
        } else {
          lines.push(pc.dim(line));
        }
      }
    }

    if (classified) {
      lines.push('');
      lines.push(`${pc.bold('Possible Causes:')}`);
      for (const cause of classified.causes) {
        lines.push(pc.dim(`  • ${cause}`));
      }
      lines.push('');
      lines.push(`${pc.bold('Suggested Fix:')} ${pc.cyan(classified.fixComment)}`);
      lines.push(pc.dim('  ' + classified.fixCode));
    }

    lines.push('');

    return lines.join('\n');
  }

  toHtmlString() {
    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const shortRefId = (this.templateId || 'unknown').substring(0, 8);
    const displayLine = this.line !== null && this.line !== undefined ? this.line : '?';
    const displayCol = this.col !== null && this.col !== undefined ? this.col : '?';

    if (this.isProduction) {
      return `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 48px auto; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); text-align: center;">
          <div style="margin-bottom: 20px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#DC2626"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <div style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px;">Rendering Interrupted</div>
          <div style="font-size: 14px; color: #6B7280; margin-bottom: 20px;">An error occurred during template rendering.</div>
          <div style="font-size: 14px; color: #111827; margin-bottom: 16px;">Reference ID: <code style="background: #F3F4F6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${shortRefId}</code></div>
          <div style="font-size: 13px; color: #9CA3AF;">Contact support with this reference ID.</div>
        </div>
      `;
    }

    const errorName = this.originalError?.name || this.name || 'Error';
    const rawMessage = this.originalError?.message || this.message || '';
    const errorText = rawMessage.split('\n').find(l => l.match(/^  Error:/i))?.replace(/^  Error:\s*/i, '') || rawMessage.split('\n').pop()?.trim() || rawMessage;

    const classified = classifyError(rawMessage);

    let headerTitle = escapeHtml(errorText);
    if (classified) {
      if (classified.category === 'undefined_variable') {
        headerTitle = `Variable '${classified.undefinedName}' is undefined or null`;
      } else if (classified.category === 'undefined_function') {
        headerTitle = `Unable to call '${classified.undefinedName}'`;
      }
    }

    const stackLines = [];
    if (this.originalError?.stack) {
      const stackParts = this.originalError.stack.split('\n');
      for (const part of stackParts) {
        const match = part.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          stackLines.push({
            func: match[1],
            file: match[2].split(/[/\\]/).pop(),
            line: match[3],
            col: match[4]
          });
        }
      }
    }

    const highlightHtml = (code) => {
      const escaped = escapeHtml(code);

      let result = escaped;

      result = result.replace(/&lt;(\/?)([\w-]+)/g, (m, slash, name) => {
        return `&lt;${slash}<span class="syntax-tag">${name}</span>`;
      });

      result = result.replace(/([\w-]+)=(&quot;[^&]*&quot;)/g, (m, attr, value) => {
        return `<span class="syntax-attr">${attr}</span>=${value}`;
      });

      return result;
    };

    let codeTraceHtml = '';
    if (this.snippet) {
      const lines = this.snippet.split('\n');
      codeTraceHtml = lines.map(line => {
        const trimmed = line.trim();
        const isError = trimmed.startsWith('>>>');
        let lineNum, code;

        if (isError) {
          const content = trimmed.replace(/^>>>\s*/, '');
          const colonIdx = content.indexOf(':');
          lineNum = colonIdx > 0 ? content.substring(0, colonIdx) : '';
          code = colonIdx > 0 ? content.substring(colonIdx + 1).trim() : content;
          return `<div class="code-line is-error"><span class="line-number">${lineNum}</span><span>&nbsp;&nbsp;<span style="color: #FF7B72; font-weight: bold;">${highlightHtml(code)}</span></span></div>`;
        }

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          lineNum = trimmed.substring(0, colonIdx);
          code = trimmed.substring(colonIdx + 1).trim();
          return `<div class="code-line"><span class="line-number">${lineNum}</span><span style="color: #8B949E;">${highlightHtml(code)}</span></div>`;
        }

        return `<div class="code-line"><span class="line-number">&nbsp;</span><span style="color: #6B7280;">${escapeHtml(trimmed)}</span></div>`;
      }).join('');
    }

    const possibleCauses = classified ? classified.causes : [
      'Check template syntax',
      'Verify variable scope'
    ];

    const fixCode = classified ? classified.fixCode : "env.addGlobal('fn', callback)";
    const fixComment = classified ? classified.fixComment : '// Register global function';

    const locationInfo = this.includeChain && this.includeChain.length > 0
      ? `${escapeHtml(this.templateName)} (included from ${escapeHtml(this.includeChain[0].parentTmpl)}:${this.includeChain[0].parentLineno})`
      : escapeHtml(this.templateName);

    const html = `
<style>
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
      The function is undefined or returned a falsey value in <span style="font-weight: 600; color: var(--color-text-primary);">${escapeHtml(this.templateName)}</span>
    </div>
  </div>

  <div style="padding: 32px;">
    <div style="margin-bottom: 32px;">
      <div class="text-label">Source Trace</div>
      <div class="code-block">
        ${codeTraceHtml || '<div class="code-line"><span class="line-number">&nbsp;</span><span>Source not available</span></div>'}
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

    ${stackLines.length > 0 ? `
    <div>
      <div class="text-label">Stack Trace</div>
      <div class="stack-container">
        ${stackLines.slice(0, 5).map((s, i) => `
          <div class="stack-row">
            <span style="font-weight:500;font-family:monospace;${i === 0 ? 'color:oklch(70% 0.12 190);' : ''}">${escapeHtml(s.func)}()</span>
            <span style="color:var(--color-text-secondary);">${escapeHtml(s.file)}:${s.line}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  </div>

  <div style="padding:16px 32px;background:light-dark(oklch(96% 0.01 285), oklch(16% 0.01 285));border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <div style="font-size:12px;color:var(--color-text-secondary);">
      Environment: <span style="font-weight:600;color:var(--color-text-primary);">${this.isProduction ? 'Production' : 'Development'}</span> &nbsp;|&nbsp;
      Reference: <span style="font-family:monospace;font-weight:600;color:var(--color-text-primary);">${shortRefId}</span>
    </div>
    <div style="display:flex;gap:12px;">
      <a href="${this.templatePath ? 'vscode://file/' + escapeHtml(this.templatePath) + ':' + displayLine + ':' + displayCol : '#'}" class="btn btn-solid" ${!this.templatePath ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
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
    const match = message.match(/\(included from ([^:)]+\.html)(?::\d+)?(?::\d+)?\)/);
    if (match) {
      return match[1];
    }
    const simpleMatch = message.match(/^\(([^)]+)\)/);
    return simpleMatch ? simpleMatch[1] : null;
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

  extractColFromMessage(message) {
    if (!message) return null;
    const colMatch = message.match(/Column (\d+)/i);
    if (colMatch) {
      return parseInt(colMatch[1], 10);
    }
    return null;
  }

  extractIncludeChainFromMessage(message) {
    if (!message) return null;
    const match = message.match(/\(included from ([^:]+\.html):(\d+)(?::(\d+))?\)/);
    if (match) {
      return [{ parentTmpl: match[1], parentLineno: parseInt(match[2], 10), parentColno: match[3] ? parseInt(match[3], 10) : null }];
    }
    return null;
  }

  async formatError(error, templateName, includeChain = null, templatePath = null) {
    const isProd = this.mode === 'production';

    const effectiveChain = includeChain || error._includeChain || null;
    const chainFromMessage = this.extractIncludeChainFromMessage(error.message);

    const chainForDisplay = effectiveChain
      ? (Array.isArray(effectiveChain) ? effectiveChain : [effectiveChain])
      : chainFromMessage;

    const hasIncludeChain = chainForDisplay && chainForDisplay.length > 0;
    const extractedTemplateName = hasIncludeChain ? null : this.extractErrorTemplateName(error.message);
    const actualTemplateName = (hasIncludeChain ? error.path : null) || extractedTemplateName || templateName;
    const actualTemplatePath = templatePath || error.templatePath || null;

    const lineFromError = error.lineno;
    const colFromError = error.colno;
    const { line: lineFromMsg, col: colFromMsg } = this.extractLineInfo(error.message);
    const colFromRawMsg = this.extractColFromMessage(error.message);
    let line = lineFromError ?? lineFromMsg;
    let col = colFromError || colFromMsg || colFromRawMsg;
    let snippet = null;

    let sourceContent = null;
    if (templatePath) {
      try {
        const fs = await import('fs');
        sourceContent = fs.readFileSync(templatePath, 'utf-8');
      } catch (e) {
        sourceContent = null;
      }
    }

    if (sourceContent) {
      const sourceLines = this.getSourceLines(sourceContent);
      const nonEmptyLines = sourceLines.filter(l => l.trim().length > 0);
      if ((line === null || line === undefined || line === 0) && nonEmptyLines.length === 1) {
        line = 0;
      }
      if (line !== null && line !== undefined) {
        const errorMeta = {
          templateName: actualTemplateName,
          templatePath: actualTemplatePath,
          templateId: null,
          line,
          col,
          snippet: null,
          includeChain: effectiveChain,
          isProduction: false,
          errorName: error.name,
          originalError: error
        };
        const tempError = new NunjucksError(error.message, errorMeta);
        snippet = tempError.getSnippet(sourceLines, line, 3);
      }
    } else if (line !== null && line !== undefined) {
      snippet = `>>> ${line}: [source not available]`;
    }

    const meta = {
      templateName: actualTemplateName,
      templatePath: actualTemplatePath,
      templateId: null,
      line,
      col,
      snippet,
      includeChain: chainForDisplay,
      isProduction: isProd,
      errorName: error.name,
      originalError: error
    };

    return new NunjucksError(error.message, meta);
  }
}

export function createErrorFormatter(dbPath, options) {
  return new ErrorFormatter(dbPath, options);
}

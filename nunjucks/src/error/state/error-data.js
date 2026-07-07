import { PATTERNS } from '../constants/patterns.js';

export const createErrorData = (error, options = {}) => {
  const {
    templateName,
    templatePath,
    sourceContent,
    includeChain = null
  } = options;

  const message = error?.message || '';
  const rawLineno = error?.lineno ?? null;
  const rawColno = error?.colno ?? null;

  const { line: extractedLine, col: extractedCol } = extractLineInfo(message);
  const colFromRawMsg = extractColFromMessage(message);

  const line = mergeValue(rawLineno, extractedLine);
  const col = mergeValue(rawColno, mergeValue(extractedCol, colFromRawMsg));

  const snippet = line !== null && sourceContent
    ? buildSnippet(sourceContent, line)
    : null;

  return {
    message,
    errorName: error?.name || 'Error',
    originalError: error,
    templateName: templateName || extractTemplateName(message) || 'unknown',
    templatePath: templatePath || null,
    line,
    col,
    snippet,
    includeChain: includeChain || extractIncludeChain(message),
    classified: classifyErrorRaw(message)
  };
};

const mergeValue = (primary, fallback) => {
  if (primary != null) return primary;
  if (fallback != null) return fallback;
  return null;
};

const extractLineInfo = (message) => {
  if (!message) return { line: null, col: null };

  const lineMatch = message.match(PATTERNS.LINE_INFO);
  if (lineMatch) {
    return {
      line: parseInt(lineMatch[1], 10),
      col: lineMatch[2] ? parseInt(lineMatch[2], 10) : null
    };
  }

  const includedMatch = message.match(/\(included from ([^:)]+):(\d+)/);
  if (includedMatch) {
    return { line: parseInt(includedMatch[2], 10), col: null };
  }

  return { line: null, col: null };
};

const extractColFromMessage = (message) => {
  if (!message) return null;
  const colMatch = message.match(/Column (\d+)/i);
  return colMatch ? parseInt(colMatch[1], 10) : null;
};

const extractTemplateName = (message) => {
  if (!message) return null;
  const match = message.match(/^\(([^)]+)\)/);
  return match ? match[1] : null;
};

const extractIncludeChain = (message) => {
  if (!message) return null;
  const match = message.match(/\(included from ([^:)]+):(\d+)(?::(\d+))?\)/g);
  if (!match) return null;

  return match.map(m => {
    const parts = m.match(/\(included from ([^:)]+):(\d+)(?::(\d+))?\)/);
    return {
      parentTmpl: parts[1],
      parentLineno: parseInt(parts[2], 10),
      parentColno: parts[3] ? parseInt(parts[3], 10) : null
    };
  });
};

const classifyErrorRaw = (message) => {
  if (!message) return null;

  if (PATTERNS.UNDEFINED_VARIABLE.test(message)) {
    const varName = extractUndefinedName(message);
    return {
      category: 'undefined_variable',
      undefinedName: varName,
      causes: ['Variable not passed in render context', 'Using undefined variable name', 'Typo in variable name'],
      fixCode: "{{ variable|default('default_value') }}",
      fixComment: '// Add default filter or pass variable in context'
    };
  }

  if (PATTERNS.UNDEFINED_FUNCTION.test(message)) {
    const fnName = extractUndefinedName(message);
    return {
      category: 'undefined_function',
      undefinedName: fnName,
      causes: [`Function '${fnName}' not registered`, 'Filter not registered', 'Misspelled name'],
      fixCode: `env.addGlobal('${fnName}', callback)`,
      fixComment: `// Register the missing function`
    };
  }

  if (PATTERNS.NOT_A_FUNCTION.test(message)) {
    return {
      category: 'not_a_function',
      undefinedName: extractUndefinedName(message),
      causes: ['Calling a non-function value', 'Variable contains wrong data type'],
      fixCode: "// Check variable type\nconsole.log(typeof variable)",
      fixComment: '// Verify the variable type'
    };
  }

  if (PATTERNS.SYNTAX_ERROR.test(message)) {
    return {
      category: 'syntax_error',
      undefinedName: null,
      causes: ['Missing closing tag', 'Mismatched quotes or brackets'],
      fixCode: "{% raw %}{{ expression }}{% endraw %}",
      fixComment: '// Use raw tag for literal content'
    };
  }

  return null;
};

const extractUndefinedName = (message) => {
  if (!message) return null;

  const callMatch = message.match(/Unable to call `([^`]+)`/);
  if (callMatch) return callMatch[1];

  const outputMatch = message.match(/attempted to output ([^ ]+)/);
  if (outputMatch) {
    const name = outputMatch[1];
    if (name === 'null' || name === 'undefined') return null;
    return name;
  }

  const notFoundMatch = message.match(/filter "([^"]+)" not found/);
  if (notFoundMatch) return notFoundMatch[1];

  return null;
};

const buildSnippet = (sourceContent, centerLine) => {
  if (!sourceContent || centerLine === null) return null;

  const lines = sourceContent.split('\n');
  const context = 3;
  const lineIndex = centerLine - 1;
  const start = Math.max(0, lineIndex - context);
  const end = Math.min(lines.length, lineIndex + context + 1);

  const snippetLines = [];
  for (let i = start; i < end; i++) {
    const lineNum = i + 1;
    const content = lines[i] || ' ';
    const prefix = lineNum === centerLine ? '>>> ' : '    ';
    snippetLines.push(`${prefix}${lineNum}: ${content}`);
  }

  return snippetLines.join('\n');
};

export const formatLocation = (errorData) => {
  const { templateName, line, col, includeChain } = errorData;

  const lineCol = line !== null ? `:${line}${col !== null ? `:${col}` : ''}` : '';
  const mainLoc = templateName + lineCol;

  if (includeChain && includeChain.length > 0) {
    const first = includeChain[0];
    const parentLoc = `${first.parentTmpl}:${first.parentLineno}${first.parentColno ? `:${first.parentColno}` : ''}`;
    return `${mainLoc} (included from ${parentLoc})`;
  }
  return mainLoc;
};

export const getDisplayMessage = (errorData) => {
  const { message, classified } = errorData;
  if (!classified) return message;

  if (classified.category === 'undefined_variable') {
    return classified.undefinedName
      ? `Variable '${classified.undefinedName}' is undefined or null`
      : 'Variable is undefined or null';
  }

  if (classified.category === 'undefined_function') {
    return classified.undefinedName
      ? `Unable to call '${classified.undefinedName}', which is undefined or falsey`
      : 'Unable to call undefined function';
  }

  if (classified.category === 'not_a_function') {
    return classified.undefinedName
      ? `'${classified.undefinedName}' is not a function`
      : 'Value is not a function';
  }

  return message;
};

export const formatCodeTrace = (snippet) => {
  if (!snippet) return [];
  return snippet.split('\n').map(l => l.trim());
};

export const formatCodeTraceHtml = (snippet) => {
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
      const escaped = escapeHtml(code);
      return `<div class="code-line is-error"><span class="line-number">${lineNum}</span><span>&nbsp;&nbsp;<span style="color: #FF7B72; font-weight: bold;">${escaped}</span></span></div>`;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const lineNum = trimmed.substring(0, colonIdx);
      const code = trimmed.substring(colonIdx + 1).trim();
      const escaped = escapeHtml(code);
      return `<div class="code-line"><span class="line-number">${lineNum}</span><span style="color: #8B949E;">${escaped}</span></div>`;
    }

    return `<div class="code-line"><span class="line-number">&nbsp;</span><span style="color: #6B7280;">${escapeHtml(trimmed)}</span></div>`;
  }).join('');
};

const escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
};

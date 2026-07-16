import { PATTERNS } from '../constants/error-patterns.js';
import { ERROR_RULES, DEFAULT_CLASSIFICATION } from '../constants/error-rules.js';
import { extractUndefinedName } from './extract.js';

const extractSubject = (rule, message) => {
  switch (rule.subjectFrom) {
    case 'undefinedName':
      return extractUndefinedName(message);
    case 'filter':
      return message.match(PATTERNS.UNDEFINED_FILTER)?.[1] || null;
    case 'quotes':
      return (message.match(/"([^"]+)"/) || [])[1] || null;
    case 'fileNotFound':
      return message.match(PATTERNS.FILE_NOT_FOUND)?.[1] || 'unknown';
    case 'unknownBlockTag':
      return message.match(PATTERNS.UNKNOWN_BLOCK_TAG)?.[1] || null;
    case 'duplicateBlock':
      return message.match(PATTERNS.DUPLICATE_BLOCK)?.[1] || null;
    case 'invalidLookup': {
      const match = message.match(PATTERNS.INVALID_LOOKUP);
      return match ? { target: match[1], value: match[2] } : null;
    }
    case 'blockedKey': {
      const accessMatch = message.match(PATTERNS.SANDBOX_ACCESS);
      if (accessMatch) return accessMatch[1];
      const setMatch = message.match(PATTERNS.SANDBOX_SET);
      if (setMatch) return setMatch[1];
      return null;
    }
    case 'searchValue': {
      const match = message.match(/"([^"]+)"/);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
};

const fill = (text, subject) => {
  if (subject && typeof subject === 'object') {
    return text
      .replaceAll('{target}', subject.target ?? '')
      .replaceAll('{subject}', subject.value ?? '');
  }
  return text.replaceAll('{subject}', subject ?? '');
};
const resolveField = (field, subject) =>
  Array.isArray(field) ? field.map(item => fill(item, subject)) : fill(field, subject);

const classifyFilterError = (rawMessage) => {
  let errorMsg = '';
  const errLine = rawMessage.split('\n').find(l => /^ {2}Error:/i.test(l));
  if (errLine) {
    errorMsg = errLine.replace(/^ {2}Error:\s*/i, '');
  } else {
    errorMsg = rawMessage.match(PATTERNS.FILTER_ERROR)?.[1] || rawMessage.split('\n').pop()?.trim() || rawMessage;
  }
  const isAsyncError = /async filter|promise|rejected|await|network/i.test(errorMsg);

  const fixCode = isAsyncError
    ? `// Async filter error - wrap in try-catch or handle rejections
async function myFilter(value) {
  try {
    return await someAsyncOperation(value);
  } catch (err) {
    console.error('Filter failed:', err.message);
    return value;
  }
}`
    : `// Filter error - check input values and implementation
function myFilter(value) {
  if (value === null || value === undefined) return '';
  // ... filter logic
}`;

  return {
    category: 'filter_error',
    undefinedName: null,
    causes: [
      '**Filter threw an error** during execution',
      `**Error**: \`${errorMsg}\``,
      isAsyncError
        ? '**Async filter** must handle rejections with `try-catch`'
        : 'Filter should handle **null/undefined** inputs'
    ],
    fixCode,
    fixComment: `// Fix: ${isAsyncError ? 'Handle async errors with try-catch' : 'Check filter input validation'}`
  };
};

export const classifyError = (rawMessage) => {
  if (!rawMessage) return DEFAULT_CLASSIFICATION;

  // Special case for 'caller' - it's a macro-specific variable
  if (/Unable to call `caller/i.test(rawMessage)) {
    return {
      category: 'undefined_function',
      undefinedName: 'caller',
      causes: [
        '`caller` is a **special macro variable** - only available inside a `call` block',
        'Used to access content from `{% call %}` blocks',
        'Cannot be used outside of macro context'
      ],
      fixCode: `{# Use caller inside a macro with call block #}
{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
      fixComment: '// caller is only available inside macros called with {% call %}'
    };
  }

  for (const rule of ERROR_RULES) {
    if (!rule.pattern || !rule.pattern.test(rawMessage)) continue;
    const subject = extractSubject(rule, rawMessage);
    return {
      category: rule.category,
      undefinedName: subject,
      causes: resolveField(rule.causes, subject),
      fixCode: resolveField(rule.fixCode, subject),
      fixComment: resolveField(rule.fixComment, subject)
    };
  }

  if (PATTERNS.FILTER_ERROR.test(rawMessage)) {
    return classifyFilterError(rawMessage);
  }

  return DEFAULT_CLASSIFICATION;
};

export const classifyFromError = (error) => {
  if (!error) return DEFAULT_CLASSIFICATION;
  if (error.code === 'FILTER_ERROR') {
    return classifyFilterError(error.message || '');
  }
  if (error.code === 'TIMEOUT') {
    return {
      category: 'timeout_error',
      undefinedName: null,
      causes: [
        'Template execution **timed out**',
        'Infinite loop or large data processing'
      ],
      fixCode: '// Increase executionTimeout or optimize template',
      fixComment: '// Set executionTimeout to a higher value or simplify template'
    };
  }
  // Special case for 'caller' - it's a macro-specific variable
  if (/Unable to call `caller/i.test(error.message || '')) {
    return {
      category: 'undefined_function',
      undefinedName: 'caller',
      causes: [
        '`caller` is a **special macro variable** - only available inside a `call` block',
        'Used to access content from `{% call %}` blocks',
        'Cannot be used outside of macro context'
      ],
      fixCode: `{# Use caller inside a macro with call block #}
{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
      fixComment: '// caller is only available inside macros called with {% call %}'
    };
  }
  if (error.code === 'UNDEFINED_BLOCK') {
    const rule = ERROR_RULES.find(r => r.category === 'undefined_block');
    if (rule) {
      const subject = error.subject || null;
      return {
        category: rule.category,
        undefinedName: subject,
        causes: resolveField(rule.causes, subject),
        fixCode: resolveField(rule.fixCode, subject),
        fixComment: resolveField(rule.fixComment, subject)
      };
    }
  }
  if (error.code === 'NO_SUPER_BLOCK') {
    const rule = ERROR_RULES.find(r => r.category === 'no_super_block');
    if (rule) {
      const subject = error.subject || null;
      return {
        category: rule.category,
        undefinedName: subject,
        causes: resolveField(rule.causes, subject),
        fixCode: resolveField(rule.fixCode, subject),
        fixComment: resolveField(rule.fixComment, subject)
      };
    }
  }
  return classifyError(error.message || '');
};

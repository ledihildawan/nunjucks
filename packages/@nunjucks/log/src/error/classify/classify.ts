import { PATTERNS } from '../messages.js';
import { RULES, DEFAULT_CLASSIFICATION } from '../rules.js';
import type { Classification } from '../rules.js';

const classifyFilterError = (rawMessage: string): Classification => {
  const errorMsg = rawMessage.split('\n').find(l => /^ {2}Error:/i.test(l))?.replace(/^ {2}Error:\s*/i, '') || rawMessage.match(PATTERNS.FILTER_ERROR)?.[1] || rawMessage.split('\n').pop()?.trim() || rawMessage;
  const isAsyncError = /async filter|promise|rejected|await|network/i.test(errorMsg);

  const fixCode = isAsyncError
    ? `async function myFilter(value) {
  try {
    return await someAsyncOperation(value);
  } catch (err) {
    console.error('Filter failed:', err.message);
    return value;
  }
}`
    : `function myFilter(value) {
  if (value === null || value === undefined) return '';
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
    fixComment: `Fix: ${isAsyncError ? 'Handle async errors with try-catch' : 'Check filter input validation'}`
  };
};

const extractSubjectFromMessage = (message: string, pattern: RegExp): string | null => {
  const match = message.match(pattern);
  return match?.[1] ?? null;
};

const replacePlaceholders = (str: string | null | undefined, undefinedName: string | null): string | null => {
  if (!str) return str ?? null;
  return str.replaceAll('{subject}', undefinedName || '').replaceAll('{target}', undefinedName || '');
};

export const classifyError = (rawMessage: string): Classification => {
  if (!rawMessage) return DEFAULT_CLASSIFICATION;

  if (/Unable to call `caller/i.test(rawMessage)) {
    return {
      category: 'undefined_function',
      undefinedName: 'caller',
      causes: [
        '`caller` is a **special macro variable** - only available inside a `call` block',
        'Used to access content from `{% call %}` blocks',
        'Cannot be used outside of macro context'
      ],
      fixCode: `{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
      fixComment: 'caller is only available inside macros called with {% call %}'
    };
  }

  for (const rule of RULES) {
    if (!rule.pattern || !rule.pattern.test(rawMessage)) continue;
    const undefinedName = extractSubjectFromMessage(rawMessage, rule.pattern);
    return {
      category: rule.category,
      undefinedName,
      title: rule.titleTemplate ? rule.titleTemplate.replaceAll('{subject}', undefinedName || '') : null,
      causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
      fixCode: replacePlaceholders(rule.fixCode, undefinedName),
      fixComment: replacePlaceholders(rule.fixComment, undefinedName)
    };
  }

  if (PATTERNS.FILTER_ERROR.test(rawMessage)) {
    return classifyFilterError(rawMessage);
  }

  return DEFAULT_CLASSIFICATION;
};

interface ErrorInput {
  message?: string;
  code?: string;
  subject?: string;
}

export const classifyFromError = (error: ErrorInput | null): Classification => {
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
      fixCode: 'Increase executionTimeout or optimize template',
      fixComment: 'Set executionTimeout to a higher value or simplify template'
    };
  }
  if (/Unable to call `caller/i.test(error.message || '')) {
    return {
      category: 'undefined_function',
      undefinedName: 'caller',
      causes: [
        '`caller` is a **special macro variable** - only available inside a `call` block',
        'Used to access content from `{% call %}` blocks',
        'Cannot be used outside of macro context'
      ],
      fixCode: `{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
      fixComment: 'caller is only available inside macros called with {% call %}'
    };
  }
  if (error.code === 'RESERVED_KEYWORD_CONTEXT') {
    const keyword = error.subject || 'unknown';
    const contextMap: Record<string, { causes: string[]; fixCode: string; fixComment: string }> = {
      'caller': {
        causes: [
          '`caller` is a **special macro variable** - only available inside a `call` block',
          'Used to access content from `{% call %}` blocks',
          'Cannot be used outside of macro context'
        ],
        fixCode: `{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
        fixComment: 'caller is only available inside macros called with {% call %}'
      },
      'super': {
        causes: [
          '`super()` can only be called inside a **block that extends a parent template**',
          'The template must use `{% extends "parent.njk" %}`',
          '`super()` calls the parent template\'s block content'
        ],
        fixCode: '{% extends "parent.njk" %}\n{% block content %}{{ super() }}{% endblock %}',
        fixComment: 'super() requires the template to extend a parent with the block'
      }
    };
    const info = contextMap[keyword] || { causes: ['Reserved keyword used outside its context'], fixCode: '', fixComment: '' };
    return { category: 'reserved_keyword_context', undefinedName: keyword, ...info };
  }
  if (error.code === 'UNDEFINED_BLOCK') {
    const rule = RULES.find(r => r.category === 'undefined_block');
    if (rule) {
      const undefinedName = error.subject || null;
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate?.replaceAll('{subject}', undefinedName || '') || null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'NO_SUPER_BLOCK' && /parent has no block/i.test(error.message || '')) {
    const rule = RULES.find(r => r.category === 'undefined_block');
    if (rule) {
      const undefinedName = error.subject || null;
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate?.replaceAll('{subject}', undefinedName || '') || null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'NO_SUPER_BLOCK') {
    const rule = RULES.find(r => r.category === 'no_super_block');
    if (rule) {
      const undefinedName = error.subject || null;
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate?.replaceAll('{subject}', undefinedName || '') || null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'UNDEFINED_VARIABLE') {
    const rule = RULES.find(r => r.category === 'undefined_variable');
    if (rule) {
      const undefinedName = error.subject || null;
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate?.replaceAll('{subject}', undefinedName || '') || null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  return classifyError(error.message || '');
};

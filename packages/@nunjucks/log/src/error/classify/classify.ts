import { PATTERNS } from '../messages.ts';
import { RULES, DEFAULT_CLASSIFICATION } from '../rules.ts';
import type { Classification } from '../rules.ts';

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
  if (error.code === 'FILE_NOT_FOUND') {
    const rule = RULES.find(r => r.category === 'file_not_found');
    const pathMatch = error.message?.match(/template not found: (.+)/i);
    const undefinedName = error.subject || pathMatch?.[1] || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate ? rule.titleTemplate.replaceAll('{subject}', undefinedName || '') : null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'CIRCULAR_INCLUDE') {
    const rule = RULES.find(r => r.category === 'circular_include');
    const pathMatch = error.message?.match(/Circular include detected: (.+)/i);
    const undefinedName = error.subject || pathMatch?.[1] || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate ? rule.titleTemplate.replaceAll('{subject}', undefinedName || '') : null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'FILESYSTEM_ERROR') {
    const rule = RULES.find(r => r.category === 'filesystem_error');
    if (rule) {
      const undefinedName = error.subject || null;
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'IMPORT_ERROR') {
    const rule = RULES.find(r => r.category === 'import_error');
    const nameMatch = error.message?.match(/Cannot import '(.+?)' from module/i);
    const undefinedName = error.subject || nameMatch?.[1] || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'SANDBOX_SET') {
    const rule = RULES.find(r => r.category === 'sandbox_blocked' && r.pattern.source.includes('Cannot set'));
    const undefinedName = error.subject || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate ? rule.titleTemplate.replaceAll('{subject}', undefinedName || '') : null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'SANDBOX_CONTEXT_MODIFY') {
    const rule = RULES.find(r => r.category === 'sandbox_blocked' && r.pattern.source.includes('context'));
    if (rule) {
      return {
        category: rule.category,
        undefinedName: null,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'SANDBOX_ALLOWLIST') {
    const rule = RULES.find(r => r.category === 'sandbox_blocked' && r.pattern.source.includes('Cannot access'));
    const undefinedName = error.subject || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate ? rule.titleTemplate.replaceAll('{subject}', undefinedName || '') : null,
        causes: rule.causes.map(c => replacePlaceholders(c, undefinedName)),
        fixCode: replacePlaceholders(rule.fixCode, undefinedName),
        fixComment: replacePlaceholders(rule.fixComment, undefinedName)
      };
    }
  }
  if (error.code === 'BLOCKED_CONTEXT_KEYS') {
    const rule = RULES.find(r => r.category === 'security_error' && r.pattern.source.includes('blocked'));
    const undefinedName = error.subject || null;
    if (rule) {
      return {
        category: rule.category,
        undefinedName,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'DANGEROUS_CONTEXT_VALUES') {
    const rule = RULES.find(r => r.category === 'security_error' && r.pattern.source.includes('dangerous values'));
    if (rule) {
      return {
        category: rule.category,
        undefinedName: null,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'DANGEROUS_TEMPLATE_CODE') {
    const rule = RULES.find(r => r.category === 'security_error' && r.pattern.source.includes('dangerous code'));
    if (rule) {
      return {
        category: rule.category,
        undefinedName: null,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'TEMPLATE_SIZE_EXCEEDED') {
    const rule = RULES.find(r => r.category === 'validation_error' && r.pattern.source.includes('Template exceeds'));
    if (rule) {
      return {
        category: rule.category,
        undefinedName: null,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  if (error.code === 'INVALID_CONFIG') {
    const rule = RULES.find(r => r.category === 'validation_error' && r.pattern.source.includes('Invalid configuration'));
    if (rule) {
      return {
        category: rule.category,
        undefinedName: null,
        title: rule.titleTemplate || null,
        causes: rule.causes,
        fixCode: rule.fixCode || null,
        fixComment: rule.fixComment || null
      };
    }
  }
  return classifyError(error.message || '');
};

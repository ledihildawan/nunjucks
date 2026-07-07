import { PATTERNS } from '../constants/patterns.js';
import { extractUndefinedName } from './extract.js';

export const classifyError = (rawMessage) => {
  if (!rawMessage) return null;

  if (PATTERNS.UNDEFINED_VARIABLE.test(rawMessage)) {
    const varName = extractUndefinedName(rawMessage);
    return {
      category: 'undefined_variable',
      undefinedName: varName,
      causes: [
        'Variable not passed in render context',
        'Using undefined variable name',
        'Typo in variable name'
      ],
      fixCode: "{{ variable |> default('default_value') }}",
      fixComment: '// Add default filter or pass variable in context'
    };
  }

  if (PATTERNS.UNDEFINED_FUNCTION.test(rawMessage)) {
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

  if (PATTERNS.NOT_A_FUNCTION.test(rawMessage)) {
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

  if (PATTERNS.SYNTAX_ERROR.test(rawMessage)) {
    return {
      category: 'syntax_error',
      undefinedName: null,
      causes: [
        'Missing closing tag ({{ endif }}, {% endfor %})',
        'Mismatched quotes or brackets',
        'Unclosed array/object brackets'
      ],
      fixCode: "{{ [1, 2, 3] |> join(',') }}",
      fixComment: '// Check brackets, quotes, and tag closures'
    };
  }

  if (PATTERNS.UNDEFINED_FILTER.test(rawMessage)) {
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

  if (PATTERNS.UNDEFINED_BLOCK.test(rawMessage)) {
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

  if (PATTERNS.NO_SUPER_BLOCK.test(rawMessage)) {
    const blockMatch = rawMessage.match(/"([^"]+)"/);
    const blockName = blockMatch ? blockMatch[1] : null;
    return {
      category: 'no_super_block',
      undefinedName: blockName,
      causes: [
        `super() called in block '${blockName}' but parent has no block`,
        'Using super() in a block that has no parent equivalent',
        'Block override without corresponding parent block'
      ],
      fixCode: '{% block ' + (blockName || 'name') + ' %}...{% endblock %}',
      fixComment: `// Remove super() or define parent block '${blockName}'`
    };
  }

  if (PATTERNS.CIRCULAR_INCLUDE.test(rawMessage)) {
    const tmplMatch = rawMessage.match(/"([^"]+)"/);
    const tmplName = tmplMatch ? tmplMatch[1] : null;
    return {
      category: 'circular_include',
      undefinedName: tmplName,
      causes: [
        'Template includes itself (directly or indirectly)',
        'Circular dependency between templates'
      ],
      fixCode: '{% include "template.html" %}',
      fixComment: '// Remove circular include or use {% import %} for shared macros'
    };
  }

  if (PATTERNS.UNDEFINED_VALUE.test(rawMessage)) {
    return {
      category: 'undefined_value',
      undefinedName: null,
      causes: [
        'Nested property access returned null/undefined',
        'Array index out of bounds',
        'Object property does not exist'
      ],
      fixCode: "{{ object.property |> default('default') }}",
      fixComment: '// Use default filter or safe navigation'
    };
  }

  if (PATTERNS.FILE_NOT_FOUND.test(rawMessage)) {
    const fileName = rawMessage.match(PATTERNS.FILE_NOT_FOUND)?.[1] || 'unknown';
    return {
      category: 'file_not_found',
      undefinedName: fileName,
      causes: [
        `Template file '${fileName}' does not exist`,
        'Incorrect path in include/extends',
        'File deleted or moved'
      ],
      fixCode: `{% include "correct-path/${fileName}" %}`,
      fixComment: `// Verify template file path: ${fileName}`
    };
  }

  if (PATTERNS.INVALID_INCLUDE.test(rawMessage)) {
    return {
      category: 'invalid_include',
      undefinedName: null,
      causes: [
        'Include path is not a string literal',
        'Variable used in include must be a string'
      ],
      fixCode: '{% include "template.html" %}',
      fixComment: '// Use string literal for include path'
    };
  }

  if (PATTERNS.FILESYSTEM_ERROR.test(rawMessage)) {
    return {
      category: 'filesystem_error',
      undefinedName: null,
      causes: [
        'Template path points to a directory instead of file',
        'File or directory does not exist',
        'Permission denied accessing file'
      ],
      fixCode: '{% include "template.html" %}',
      fixComment: '// Verify template path is a valid file'
    };
  }

  if (PATTERNS.FILTER_ERROR.test(rawMessage)) {
    const errorMsg = rawMessage.match(PATTERNS.FILTER_ERROR)?.[1] || rawMessage;
    const isAsyncError = /async filter|promise|rejected|await|network/i.test(errorMsg);

    const fixCode = isAsyncError
      ? `// Async filter error - wrap in try-catch or handle rejections
async function myFilter(value) {
  try {
    return await someAsyncOperation(value);
  } catch (err) {
    console.error('Filter failed:', err.message);
    return value; // or a default value
  }
}`
      : `// Filter error - check input values and implementation
function myFilter(value) {
  if (value == null) return '';
  // ... filter logic
}`;

    return {
      category: 'filter_error',
      undefinedName: null,
      causes: [
        'Filter threw an error during execution',
        `Error: ${errorMsg}`,
        isAsyncError ? 'Async filter must handle rejections with try-catch' : 'Filter should handle null/undefined inputs'
      ],
      fixCode,
      fixComment: `// Fix: ${isAsyncError ? 'Handle async errors with try-catch' : 'Check filter input validation'}`
    };
  }

  return null;
};

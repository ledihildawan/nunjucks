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
      fixCode: "{{ variable|default('default_value') }}",
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
        'Mismatched quotes or brackets'
      ],
      fixCode: "{% raw %}{{ expression }}{% endraw %}",
      fixComment: '// Use raw tag for literal content'
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

  return null;
};

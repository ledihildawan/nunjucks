import { PATTERNS } from './patterns.js';

export const ERROR_MAPPINGS = [
  {
    patterns: [PATTERNS.UNDEFINED_VARIABLE],
    causes: [
      'Variable not passed in render context',
      'Using undefined variable name',
      'Typo in variable name'
    ]
  },
  {
    patterns: [PATTERNS.UNDEFINED_FUNCTION],
    causes: [
      'Function not registered with env.addGlobal()',
      'Filter not registered with env.addFilter()',
      'Misspelled function or filter name'
    ]
  },
  {
    patterns: [PATTERNS.NOT_A_FUNCTION],
    causes: [
      'Calling a non-function value',
      'Variable contains wrong data type'
    ]
  },
  {
    patterns: [PATTERNS.SYNTAX_ERROR],
    causes: [
      'Missing closing tag ({{ endif }}, {% endfor %})',
      'Mismatched quotes or brackets'
    ]
  },
  {
    patterns: [PATTERNS.UNDEFINED_FILTER],
    causes: [
      'Filter not registered with env.addFilter()',
      'Typo in filter name'
    ]
  },
  {
    patterns: [PATTERNS.UNDEFINED_BLOCK],
    causes: [
      'Extending template without block definition',
      'Incorrect block name'
    ]
  }
];

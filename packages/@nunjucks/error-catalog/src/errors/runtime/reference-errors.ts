import { createErrorDefinition } from '../factory.ts';
import { firstCapture } from '../types.ts';

const UNDEFINED_FUNCTION = createErrorDefinition({
  name: 'UNDEFINED_FUNCTION',
  message: "Function '{name}' is not defined",
  category: 'undefined_function',
  causes: [
    'The function `{subject}` was not registered in the factory config (`globals`) or a plugin',
    'You may have meant a filter - check if `{subject}` is registered in the factory config (`filters`)',
    'A typo in the function name (case-sensitive)',
    'Missing import - the function may live in another module',
  ],
  fixCode: "const njk = nunjucks({ globals: { '{subject}': () => { /* ... */ } } })",
  fixComment: 'Register the missing function in the factory config `globals` before rendering',
});

const UNDEFINED_FILTER = createErrorDefinition({
  name: 'UNDEFINED_FILTER',
  message: "Filter '{name}' is not defined",
  category: 'undefined_filter',
  causes: [
    'The filter `{subject}` was not registered in the factory config (`filters`) or a plugin',
    'A typo in the filter name (case-sensitive)',
    'The input value is `undefined` - check the variable being filtered exists',
    'You may have meant a global function - check the factory config (`globals`)',
  ],
  fixCode: "const njk = nunjucks({ filters: { '{subject}': (value) => value } })",
  fixComment: 'Register the missing filter in the factory config `filters` before rendering',
  documentationUrl: 'https://mozilla.github.io/nunjucks/templating.html#filters',
});

const UNDEFINED_TEST = createErrorDefinition({
  name: 'UNDEFINED_TEST',
  message: "Test '{name}' is not defined",
  category: 'undefined_test',
  causes: [
    'The test `{subject}` was not registered in the factory config (`tests`) or a plugin',
    'A typo in the test name (case-sensitive)',
    'Built-in tests like `defined`, `undefined`, `null` may be what you want',
  ],
  fixCode: "const njk = nunjucks({ tests: { '{subject}': (value) => false } })",
  fixComment: 'Register the missing test in the factory config `tests`',
});

const UNDEFINED_BLOCK = createErrorDefinition({
  name: 'UNDEFINED_BLOCK',
  message: 'Undefined block: {name}',
  category: 'undefined_block',
  causes: [
    'The child template overrides block `{subject}`, but the parent template never defines it',
    'The block name `{subject}` may be misspelled in either the child or parent template',
    'The template may be extending the wrong parent file',
    'The parent file failed to load and is empty',
  ],
  fixCode: '{% extends "base.njk" %}\n\n{% block content %}\n  Your content here\n{% endblock %}',
  fixComment: 'Either rename the block or add the corresponding block to the parent template',
});

const UNDEFINED_EXTENSION = createErrorDefinition({
  name: 'UNDEFINED_EXTENSION',
  message: "Extension '{name}' is not registered",
  category: 'undefined_function',
  causes: [
    'The extension `{subject}` was not registered in the factory config (`extensions`) or a plugin',
    'A custom tag `{% {subject} %}` was used but the extension defining it was not provided',
    'A typo in the extension name (case-sensitive)',
    'The extension was folded via a plugin that did not contribute its `tags`',
  ],
  fixCode:
    "const njk = nunjucks({ extensions: { '{subject}': { tags: ['{subject}'], run: (ctx, ...args) => '' } } })",
  fixComment: 'Register the extension in the factory config or via a plugin',
});

const UNKNOWN_BLOCK_RUNTIME = {
  name: 'UNKNOWN_BLOCK_RUNTIME',
  message: 'unknown block "{name}"',
  pattern: /^unknown block "([^"]+)"$|parent has no block/iu,
  category: 'undefined_block',
  titleTemplate: "Block '{subject}' does not exist in the parent template",
  causes: [
    'The child template overrides block `{subject}`, but the parent template never defines it',
    'The block name `{subject}` may be misspelled in either the child or parent template',
    'The template may be extending the wrong parent file',
    '`{{ super() }}` is being called but the parent block does not exist',
  ],
  fixCode: '{% block content %}\n  {{ super() }}\n  Additional child content\n{% endblock %}',
  fixComment: 'Rename the child block or remove the `super()` call',
  severity: 'error' as const,
  subjectFrom: firstCapture,
};

const DUPLICATE_BLOCK = createErrorDefinition({
  name: 'DUPLICATE_BLOCK',
  message: 'Block "{name}" defined more than once',
  category: 'duplicate_block',
  causes: [
    'The block `{subject}` is defined multiple times in the same template',
    'A copy-paste error left two block declarations with the same name',
    'The template is being compiled twice (e.g. included and extended simultaneously)',
  ],
  fixCode: '{% block content %}{% endblock %}',
  fixComment: 'Remove or rename the duplicate block',
});

const NO_SUPER_BLOCK = {
  name: 'NO_SUPER_BLOCK',
  message: 'No super block available',
  pattern: /no super block available|called super\(\) in a block without parent/iu,
  category: 'no_super_block',
  titleTemplate: 'Cannot call super() - parent has no block',
  causes: [
    '`super()` was called inside block `{subject}` but the parent template does not define it',
    'The template is being rendered without extending a parent',
    'The parent block was removed or renamed in the parent file',
  ],
  fixCode:
    '{% block {subject} %}\n  {% if false %}{{ super() }}{% endif %}\n  Your content\n{% endblock %}',
  fixComment: 'Guard the `super()` call with an `{% if %}` or remove it',
  severity: 'error' as const,
};

const RESERVED_KEYWORD = {
  name: 'RESERVED_KEYWORD',
  message: "Cannot use reserved {type} '{name}'",
  pattern: /^Cannot use reserved (.+) '([^']+)'$/iu,
  category: 'reserved_keyword',
  titleTemplate: "Cannot use reserved keyword '{subject}'",
  causes: [
    'Used a **reserved JavaScript or nunjucks keyword** as a custom name',
    'Trying to override built-in names like `if`, `for`, `block`, `component`',
    'The reserved keyword conflicts with parser internals',
  ],
  fixCode: "const njk = nunjucks({ filters: { 'my{subject}': (value) => value } })",
  fixComment: 'Choose a different name with a prefix or suffix to avoid the conflict',
  severity: 'error' as const,
  subjectFrom: null,
};

const RESERVED_KEYWORD_CONTEXT = {
  name: 'RESERVED_KEYWORD_CONTEXT',
  message: "Cannot use reserved keyword '{name}' outside of its intended context",
  pattern:
    /reserved keyword.*context|cannot use.*reserved keyword/iu,
  category: 'reserved_keyword_context',
  titleTemplate: "Cannot use reserved keyword '{subject}' outside of its intended context",
  causes: [
    '`{subject}` is a **reserved keyword** with special context requirements',
    'Only available in specific template constructs',
  ],
  fixCode: 'Use {subject} only in its intended context',
  fixComment: 'Review when {subject} can be used',
  severity: 'error' as const,
  subjectFrom: firstCapture,
};

export {
  DUPLICATE_BLOCK,
  NO_SUPER_BLOCK,
  RESERVED_KEYWORD,
  RESERVED_KEYWORD_CONTEXT,
  UNDEFINED_BLOCK,
  UNDEFINED_EXTENSION,
  UNDEFINED_FILTER,
  UNDEFINED_FUNCTION,
  UNDEFINED_TEST,
  UNKNOWN_BLOCK_RUNTIME,
};

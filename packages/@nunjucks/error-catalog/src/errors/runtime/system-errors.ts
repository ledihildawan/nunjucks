import { createErrorDefinition } from '../factory.ts';

const TIMEOUT = {
  name: 'TIMEOUT',
  message: 'Template rendering timed out after {ms}ms',
  pattern: /^Template rendering timed out after (\d+)ms$/iu,
  category: 'timeout_error',
  titleTemplate: 'Template rendering timed out',
  causes: [
    'The template **took too long** to execute',
    'An infinite loop in the template logic (e.g. recursive macro)',
    'Large data processing in template (e.g. nested loops over millions of items)',
    'A blocking operation that does not resolve'
  ],
  fixCode: '{{ env.opts.executionTimeout = 60000; /* 60s */ }}',
  fixComment: 'Increase the `executionTimeout` config or simplify the template',
  subjectFrom: null
};

const ASSERT_TYPE_ERROR = createErrorDefinition({
  name: 'ASSERT_TYPE_ERROR',
  message: 'Invalid type assertion',
  category: 'type_error',
  causes: [
    'An internal type assertion failed in the compiler',
    'The AST contains an unexpected node shape',
    'This indicates a bug in nunjucks itself'
  ],
  fixCode: '/* Please report this as a bug at https://github.com/mozilla/nunjucks/issues */',
  fixComment: 'This is a nunjucks internal error - not caused by your template',
  documentationUrl: 'https://github.com/mozilla/nunjucks/issues'
});

const UNAVAILABLE_IN_ENV = createErrorDefinition({
  name: 'UNAVAILABLE_IN_ENV',
  message: 'not available in this environment',
  category: 'unavailable',
  causes: [
    'The environment was created without registering this filter or test',
    'A custom environment is missing the filter/test handler'
  ],
  fixCode: 'env.addFilter(\'{name}\', function(value) { return value; })',
  fixComment: 'Register the missing filter with `env.addFilter()` or test with `env.addTest()`'
});

const EXEC_EXPRESSION_ERROR = createErrorDefinition({
  name: 'EXEC_EXPRESSION_ERROR',
  message: 'Exec expression failed: {detail}',
  category: 'runtime_error',
  causes: [
    'Variable referenced in `{% exec %}` was not passed to the render context',
    'The expression calls a method on a value that does not support it',
    'Data preparation should happen in your **controller** before render'
  ],
  fixCode: '// Controller — before render():\nconst items = prepareItems();\nrender(template, { items })',
  fixComment: 'Use {% exec %} only for rendering state. Move data logic to your controller.',
  extraFrom: (groups: RegExpMatchArray) => ({ detail: groups[1] ?? '' })
});

export { TIMEOUT, ASSERT_TYPE_ERROR, UNAVAILABLE_IN_ENV, EXEC_EXPRESSION_ERROR };

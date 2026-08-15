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
    'A blocking operation that does not resolve',
  ],
  fixCode: '{{ env.opts.executionTimeout = 60000; /* 60s */ }}',
  fixComment: 'Increase the `executionTimeout` config or simplify the template',
  severity: 'error' as const,
  subjectFrom: null,
};

const ASSERT_TYPE_ERROR = createErrorDefinition({
  name: 'ASSERT_TYPE_ERROR',
  message: 'Invalid type assertion',
  category: 'type_error',
  causes: [
    'An internal type assertion failed in the compiler',
    'The AST contains an unexpected node shape',
    'This indicates a bug in nunjucks itself',
  ],
  fixCode: '/* Please report this as a bug at https://github.com/mozilla/nunjucks/issues */',
  fixComment:
    'This is a nunjucks internal error — not caused by your template. If this is reproducible, please open an issue with the template that triggered it and the full stack trace.',
  documentationUrl: 'https://github.com/mozilla/nunjucks/issues',
});

const INVALID_ASSIGN_TARGET = createErrorDefinition({
  name: 'INVALID_ASSIGN_TARGET',
  message: 'Invalid left-hand side expression',
  category: 'runtime_error',
  causes: [
    'The `++`/`--` operator targeted a non-variable expression (e.g. a lookup or literal)',
    'Only plain variable names are valid increment/decrement targets',
  ],
  fixCode: '{% set counter = counter + 1 %}',
  fixComment: 'Target a variable name, or compute the new value with `{% set %}`',
});

const STREAM_ALREADY_CONSUMED = createErrorDefinition({
  name: 'STREAM_ALREADY_CONSUMED',
  message:
    'renderToStream: stream already consumed — a stream is single-use; call renderToStream() again for a fresh stream',
  category: 'api_misuse',
  causes: [
    'The same stream returned by `renderToStream()` was iterated a second time',
    'A render stream is single-use — each iteration drains the underlying generator',
  ],
  fixCode: "const result = await njk.renderToStream(template); // call again for a fresh stream",
  fixComment: 'Call `renderToStream()` again to obtain a new stream instead of re-iterating the old one',
});

const UNAVAILABLE_IN_ENV = createErrorDefinition({
  name: 'UNAVAILABLE_IN_ENV',
  message: 'not available in this environment',
  category: 'unavailable',
  causes: [
    'The environment was created without registering this filter or test',
    'A custom environment is missing the filter/test handler',
  ],
  fixCode: "env.addFilter('myFilter', function(value) { return value; })",
  fixComment: 'Register the missing filter with `env.addFilter()` or test with `env.addTest()`',
});

const EXEC_EXPRESSION_ERROR = createErrorDefinition({
  name: 'EXEC_EXPRESSION_ERROR',
  message: 'Exec expression failed: {detail}',
  category: 'runtime_error',
  causes: [
    'Variable referenced in `{% exec %}` was not passed to the render context',
    'The expression calls a method on a value that does not support it',
    'Data preparation should happen in your **controller** before render',
  ],
  fixCode:
    '// Controller — before render():\nconst items = prepareItems();\nconst njk = nunjucks({});\nawait njk.render(template, { items })',
  fixComment: 'Use {% exec %} only for rendering state. Move data logic to your controller.',
  extraFrom: (groups: RegExpMatchArray) => ({ detail: groups[1] ?? '' }),
});

export {
  ASSERT_TYPE_ERROR,
  EXEC_EXPRESSION_ERROR,
  INVALID_ASSIGN_TARGET,
  STREAM_ALREADY_CONSUMED,
  TIMEOUT,
  UNAVAILABLE_IN_ENV,
};

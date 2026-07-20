import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const SANDBOX_ERRORS = {
  SANDBOX_ACCESS: {
    name: 'SANDBOX_ACCESS',
    message: "Cannot access '{key}' in sandbox mode",
    pattern: /^Cannot access '([^']+)' in sandbox mode$/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot access '{subject}' in sandbox mode",
    causes: [
      '**Sandbox mode** blocks access to dangerous properties like `{subject}`',
      'The template tried to reach internal JavaScript or DOM properties',
      'Property `{subject}` is in the sandbox blocklist by default'
    ],
    fixCode: '{{ allowedProperty }}',
    fixComment: 'Use only sandbox-allowed properties, or add `{subject}` to the allowlist',
    subjectFrom: firstCapture
  },
  SANDBOX_SET: {
    name: 'SANDBOX_SET',
    message: "Cannot set '{key}' in sandbox mode",
    pattern: /^Cannot set '([^']+)' in sandbox mode$/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot set '{subject}' in sandbox mode",
    causes: [
      '**Sandbox mode** blocks assignments to dangerous properties like `{subject}`',
      'Trying to modify `__proto__`, `constructor`, or other reserved names',
      'Prototype pollution attempt was blocked'
    ],
    fixCode: '{% set safeVar = value %}',
    fixComment: 'Use a regular variable instead of mutating an object property',
    subjectFrom: firstCapture
  },
  SANDBOX_ALLOWLIST: {
    name: 'SANDBOX_ALLOWLIST',
    message: "'{key}' is not allowed in sandbox mode. Add it to allowlist.",
    pattern: /^'([^']+)' is not allowed in sandbox mode\. Add it to allowlist\.$/i,
    category: 'sandbox_blocked',
    titleTemplate: "'{subject}' is not allowed in sandbox mode",
    causes: [
      '**Sandbox mode** uses allowlist mode and `{subject}` is not in it',
      'The default sandbox blocks `{subject}` for safety reasons',
      'You have not whitelisted `{subject}` for this template'
    ],
    fixCode: 'env.sandboxAllowlist.push("{subject}")',
    fixComment: 'Add `{subject}` to `sandboxAllowlist` or disable allowlist mode',
    subjectFrom: firstCapture
  },
  SANDBOX_CONTEXT_MODIFY: {
    name: 'SANDBOX_CONTEXT_MODIFY',
    message: 'Cannot modify context in sandbox mode',
    pattern: /^Cannot modify context in sandbox mode$/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot modify sandboxed context",
    causes: [
      'Attempted to modify the **sandboxed render context**',
      'Tried to set globals or protected keys from inside the template',
      '`{% set %}` was used with a reserved context key'
    ],
    fixCode: '{% set localVar = value %}',
    fixComment: 'Set local template variables instead of modifying the context',
    subjectFrom: null
  },
  SANDBOX_CODE_EXECUTION: {
    name: 'SANDBOX_CODE_EXECUTION',
    message: 'Code execution is blocked',
    pattern: /Sandbox: Code execution.*is blocked/i,
    category: 'sandbox_blocked',
    titleTemplate: 'Code execution is blocked in sandbox mode',
    causes: [
      '**Sandbox mode** blocks string-based code execution for safety',
      'APIs like `setTimeout`, `eval`, or `Function` cannot receive string code',
      'A filter tried to invoke a code-execution API'
    ],
    fixCode: '{{ setTimeout(callback, 0) }}',
    fixComment: 'Pass a function reference instead of a string of code',
    subjectFrom: null
  },
  SANDBOX_TIMEOUT_EXEC: {
    name: 'SANDBOX_TIMEOUT_EXEC',
    message: 'Sandbox timeout',
    pattern: /frame\.push is not a function/i,
    category: 'timeout_error',
    titleTemplate: 'Template execution timed out',
    causes: [
      'Template execution **timed out** before completion',
      'An infinite loop or unbounded recursion',
      'Large data processing that exceeds the timeout'
    ],
    fixCode: 'env.opts.executionTimeout = 60000',
    fixComment: 'Increase `executionTimeout` or refactor to break long work into smaller chunks',
    subjectFrom: null
  },
  SANDBOX_CONTEXT_ERROR: {
    name: 'SANDBOX_CONTEXT_ERROR',
    message: 'Sandbox context error',
    pattern: /Value is not a function/i,
    category: 'sandbox_blocked',
    titleTemplate: 'Cannot modify sandboxed context',
    causes: [
      'Attempted to access or modify **sandboxed context**',
      'Template tried to use restricted functionality',
      'Calling a blocked global function in sandbox mode'
    ],
    fixCode: '{{ value }}',
    fixComment: 'Use only allowed operations in sandbox mode',
    subjectFrom: null
  },
  SANDBOX_PROTO_ACCESS: {
    name: 'SANDBOX_PROTO_ACCESS',
    message: 'Sandbox proto access',
    pattern: /Cannot read properties of undefined \(reading 'charAt'\)/i,
    category: 'sandbox_blocked',
    titleTemplate: 'Cannot access property in sandbox mode',
    causes: [
      'Attempted to access **undefined variable** in sandbox mode',
      'Accessing properties on undefined in sandboxed template',
      'A property path goes through an undefined intermediate value'
    ],
    fixCode: '{{ value |> default("") }}',
    fixComment: 'Use `default()` filter or check for undefined before accessing properties',
    subjectFrom: null
  },
  BLOCKED_CONTEXT_KEYS: {
    name: 'BLOCKED_CONTEXT_KEYS',
    message: 'Cannot use blocked keys in context: {keys}',
    pattern: /^Cannot use blocked keys in context: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contains **blocked keys** like `__proto__`, `constructor`, or `prototype`',
      'Dangerous keys detected in the render context',
      'Object was not properly sanitized before passing to render'
    ],
    fixCode: 'const safe = JSON.parse(JSON.stringify(context)); delete safe.__proto__;',
    fixComment: 'Clean the context object before passing it to render',
    subjectFrom: null
  },
  DANGEROUS_CONTEXT_VALUES: {
    name: 'DANGEROUS_CONTEXT_VALUES',
    message: 'Context contains unsafe values: {values}',
    pattern: /^Context contains unsafe values: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contains **dangerous values** like `eval`, `Function`, or `process`',
      'Potentially malicious functions in the render context',
      'A user-supplied object was not sanitized'
    ],
    fixCode: 'const safe = Object.assign({}, context, { eval: undefined, Function: undefined });',
    fixComment: 'Remove dangerous functions from the context before rendering',
    subjectFrom: null
  },
  DANGEROUS_CONTEXT_VALUE_SCRUBBED: {
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: 'Scrubbed unsafe values from context: {values}',
    pattern: /^Scrubbed unsafe values from context: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contained **dangerous values** that were automatically removed',
      'Security scrubbing removed `eval`, `Function`, or other dangerous globals',
      'The template may not behave as expected after scrubbing'
    ],
    fixCode: 'const safe = Object.assign({}, context, { eval: undefined, Function: undefined });',
    fixComment: 'Clean the context yourself before passing to render',
    subjectFrom: null
  },
  DANGEROUS_TEMPLATE_CODE: {
    name: 'DANGEROUS_TEMPLATE_CODE',
    message: 'Template contains unsafe code: {violations}',
    pattern: /^Template contains unsafe code: (.+)$/i,
    category: 'security_error',
    causes: [
      'Template contains **dangerous code patterns** that the security scanner caught',
      'Attempted to access global objects like `process`, `require`, or `global`',
      'Use of `eval`, `Function`, or other code-execution APIs'
    ],
    fixCode: '/* Refactor to use env globals or filters instead of direct code execution */',
    fixComment: 'Remove dangerous code from the template',
    documentationUrl: 'https://mozilla.github.io/nunjucks/api.html#security',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type SandboxErrorName = keyof typeof SANDBOX_ERRORS;

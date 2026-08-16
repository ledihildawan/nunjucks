import { createErrorDefinition } from './factory.ts';

export const SANDBOX_ERRORS = {
  SANDBOX_ACCESS: createErrorDefinition({
    name: 'SANDBOX_ACCESS',
    message: "Cannot access '{key}' in sandbox mode",
    category: 'sandbox_blocked',
    causes: [
      '**Sandbox mode** blocks access to dangerous properties like `{key}`',
      'The template tried to reach internal JavaScript or DOM properties',
      'Property `{key}` is in the sandbox blocklist by default',
    ],
    fixCode: '{{ allowedProperty }}',
    fixComment: 'Use only sandbox-allowed properties, or add `{key}` to the allowlist',
  }),
  SANDBOX_SET: createErrorDefinition({
    name: 'SANDBOX_SET',
    message: "Cannot set '{key}' in sandbox mode",
    category: 'sandbox_blocked',
    causes: [
      '**Sandbox mode** blocks assignments to dangerous properties like `{key}`',
      'Trying to modify `__proto__`, `constructor`, or other reserved names',
      'Prototype pollution attempt was blocked',
    ],
    fixCode: '{{ safeVar := value }}',
    fixComment: 'Use a regular variable instead of mutating an object property',
  }),
  SANDBOX_ALLOWLIST: createErrorDefinition({
    name: 'SANDBOX_ALLOWLIST',
    message: "'{key}' is not allowed in sandbox mode. Add it to allowlist.",
    category: 'sandbox_blocked',
    causes: [
      '**Sandbox mode** uses allowlist mode and `{key}` is not in it',
      'The default sandbox blocks `{key}` for safety reasons',
      'You have not whitelisted `{key}` for this template',
    ],
    fixCode: 'env.sandboxAllowlist.push("{key}")',
    fixComment: 'Add `{key}` to `sandboxAllowlist` or disable allowlist mode',
  }),
  SANDBOX_CONTEXT_MODIFY: createErrorDefinition({
    name: 'SANDBOX_CONTEXT_MODIFY',
    message: 'Cannot modify context in sandbox mode',
    category: 'sandbox_blocked',
    causes: [
      'Attempted to modify the **sandboxed render context**',
      'Tried to set globals or protected keys from inside the template',
      'A `:=` declaration was used with a reserved context key',
    ],
    fixCode: '{{ localVar := value }}',
    fixComment: 'Set local template variables instead of modifying the context',
  }),
  SANDBOX_CODE_EXECUTION: createErrorDefinition({
    name: 'SANDBOX_CODE_EXECUTION',
    message: 'Code execution is blocked',
    category: 'sandbox_blocked',
    causes: [
      '**Sandbox mode** blocks string-based code execution for safety',
      'APIs like `setTimeout`, `eval`, or `Function` cannot receive string code',
      'A filter tried to invoke a code-execution API',
    ],
    fixCode: '{{ setTimeout(callback, 0) }}',
    fixComment: 'Pass a function reference instead of a string of code',
  }),
  SANDBOX_TIMEOUT_EXEC: createErrorDefinition({
    name: 'SANDBOX_TIMEOUT_EXEC',
    message: 'Sandbox timeout',
    category: 'timeout_error',
    causes: [
      'Template execution **timed out** before completion',
      'An infinite loop or unbounded recursion',
      'Large data processing that exceeds the timeout',
    ],
    fixCode: 'env.opts.executionTimeout = 60000',
    fixComment: 'Increase `executionTimeout` or refactor to break long work into smaller chunks',
  }),
  SANDBOX_CONTEXT_ERROR: createErrorDefinition({
    name: 'SANDBOX_CONTEXT_ERROR',
    message: 'Sandbox context error',
    category: 'sandbox_blocked',
    causes: [
      'Attempted to access or modify **sandboxed context**',
      'Template tried to use restricted functionality',
      'Calling a blocked global function in sandbox mode',
    ],
    fixCode: '{{ value }}',
    fixComment: 'Use only allowed operations in sandbox mode',
  }),
  SANDBOX_PROTO_ACCESS: createErrorDefinition({
    name: 'SANDBOX_PROTO_ACCESS',
    message: 'Sandbox prototype access blocked',
    category: 'security_error',
    causes: [
      'Attempted to access a **prototype-pollution vector** (`__proto__`, `constructor`, or `prototype`) in sandbox mode',
      'Sandbox blocks these object intrinsics to prevent privilege escalation and prototype tampering',
      'A property lookup resolved to a dangerous intrinsic key',
    ],
    fixCode: '{{ value }}',
    fixComment:
      'Use a safe own-property name instead of `__proto__`, `constructor`, or `prototype`',
  }),
  BLOCKED_CONTEXT_KEYS: createErrorDefinition({
    name: 'BLOCKED_CONTEXT_KEYS',
    message: 'Cannot use blocked keys in context: {keys}',
    category: 'security_error',
    causes: [
      '**Render context** contains keys listed in `blockedContextKeys` (e.g. `{keys}`)',
      'Template tried to access `{keys}` which you have explicitly blocked',
      'Either remove the key from `blockedContextKeys`, or stop referencing it in the template',
    ],
    fixCode: "nunjucks({ security: { blockedContextKeys: ['{keys}'] } }).render(template, ctx)",
    fixComment: 'Pass the value via a non-blocked name, or remove it from `blockedContextKeys`',
    extraFrom: (groups: RegExpMatchArray) => ({ keys: groups[1] ?? '' }),
  }),
  DANGEROUS_CONTEXT_VALUES: createErrorDefinition({
    name: 'DANGEROUS_CONTEXT_VALUES',
    message: 'Context contains unsafe values: {values}',
    category: 'security_error',
    causes: [
      'Context contains **dangerous values** like `eval`, `Function`, or `process`',
      'Potentially malicious functions in the render context',
      'A user-supplied object was not sanitized',
    ],
    fixCode: 'const safe = Object.assign({}, context, { eval: undefined, Function: undefined });',
    fixComment: 'Remove dangerous functions from the context before rendering',
    extraFrom: (groups: RegExpMatchArray) => ({ values: groups[1] || '' }),
  }),
  DANGEROUS_CONTEXT_VALUE_SCRUBBED: createErrorDefinition({
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: 'Scrubbed unsafe values from context: {values}',
    category: 'security_error',
    // WHY: severity 'warning' — this is a remediation NOTICE (values were removed and
    // rendering continued), logged via createLog('warning') in the render pipeline.
    severity: 'warning',
    causes: [
      'Context contained **dangerous values** that were automatically removed',
      'Security scrubbing removed `eval`, `Function`, or other dangerous globals',
      'The template may not behave as expected after scrubbing',
    ],
    fixCode: 'const safe = Object.assign({}, context, { eval: undefined, Function: undefined });',
    fixComment: 'Clean the context yourself before passing to render',
    extraFrom: (groups: RegExpMatchArray) => ({ values: groups[1] ?? '' }),
  }),
  DANGEROUS_TEMPLATE_CODE: createErrorDefinition({
    name: 'DANGEROUS_TEMPLATE_CODE',
    message: 'Template contains unsafe code: {violations}',
    category: 'security_error',
    causes: [
      'Template contains **dangerous code patterns** that the security scanner caught',
      'Attempted to access global objects like `process`, `require`, or `global`',
      'Use of `eval`, `Function`, or other code-execution APIs',
    ],
    fixCode: '/* Refactor to use env globals or filters instead of direct code execution */',
    fixComment: 'Remove dangerous code from the template',
    documentationUrl: 'https://mozilla.github.io/nunjucks/api.html#security',
    extraFrom: (groups: RegExpMatchArray) => ({ violations: groups[1] ?? '' }),
  }),
} as const;



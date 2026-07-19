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
      '**Sandbox mode** blocks access to `{subject}`',
      'Dangerous property access attempted in sandboxed template'
    ],
    fixCode: 'Remove access to blocked property or disable sandbox',
    fixComment: 'Remove access to {subject} in your template',
    subjectFrom: firstCapture
  },
  SANDBOX_SET: {
    name: 'SANDBOX_SET',
    message: "Cannot set '{key}' in sandbox mode",
    pattern: /^Cannot set '([^']+)' in sandbox mode$/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot set '{subject}' in sandbox mode",
    causes: [
      '**Sandbox mode** blocks setting `{subject}`',
      'Attempted to modify blocked property in sandboxed template'
    ],
    fixCode: 'Remove assignment to blocked property or disable sandbox',
    fixComment: 'Remove assignment to {subject} in your template',
    subjectFrom: firstCapture
  },
  SANDBOX_ALLOWLIST: {
    name: 'SANDBOX_ALLOWLIST',
    message: "'{key}' is not allowed in sandbox mode. Add it to allowlist.",
    pattern: /^'([^']+)' is not allowed in sandbox mode\. Add it to allowlist\.$/i,
    category: 'sandbox_blocked',
    titleTemplate: "'{subject}' is not allowed in sandbox mode",
    causes: [
      '**Sandbox mode** blocks access to `{subject}`',
      'Property not in allowlist'
    ],
    fixCode: 'Add to sandbox allowlist or disable sandbox',
    fixComment: 'Add {subject} to sandbox allowlist or disable sandbox',
    subjectFrom: firstCapture
  },
  SANDBOX_CONTEXT_MODIFY: {
    name: 'SANDBOX_CONTEXT_MODIFY',
    message: 'Cannot modify context in sandbox mode',
    pattern: /^Cannot modify context in sandbox mode$/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot modify sandboxed context",
    causes: [
      'Attempted to modify **sandboxed context**',
      'Setting globals or protected keys in sandbox mode'
    ],
    fixCode: 'Disable sandbox or use allowed keys',
    fixComment: 'Remove the set statement or disable sandbox mode',
    subjectFrom: null
  },
  SANDBOX_CODE_EXECUTION: {
    name: 'SANDBOX_CODE_EXECUTION',
    message: 'Code execution is blocked',
    pattern: /Sandbox: Code execution.*is blocked/i,
    category: 'sandbox_blocked',
    titleTemplate: 'Code execution is blocked in sandbox mode',
    causes: [
      '**Sandbox mode** blocks string-based code execution',
      'APIs like `setTimeout`, `eval`, or `Function` cannot receive code strings'
    ],
    fixCode: '{{ setTimeout(callback, 0) }}',
    fixComment: 'Pass a safe callback or remove code execution from the template',
    subjectFrom: null
  },
  SANDBOX_TIMEOUT_EXEC: {
    name: 'SANDBOX_TIMEOUT_EXEC',
    message: 'Sandbox timeout',
    pattern: /frame\.push is not a function/i,
    category: 'timeout_error',
    titleTemplate: "Template execution timed out",
    causes: [
      'Template execution **timed out**',
      'Infinite loop or large data processing'
    ],
    fixCode: 'Increase executionTimeout or optimize template',
    fixComment: 'Set executionTimeout to a higher value or simplify template',
    subjectFrom: null
  },
  SANDBOX_CONTEXT_ERROR: {
    name: 'SANDBOX_CONTEXT_ERROR',
    message: 'Sandbox context error',
    pattern: /Value is not a function/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot modify sandboxed context",
    causes: [
      'Attempted to access or modify **sandboxed context**',
      'Template tried to use restricted functionality'
    ],
    fixCode: 'Disable sandbox or use allowed operations',
    fixComment: 'Sandbox mode restricts certain operations',
    subjectFrom: null
  },
  SANDBOX_PROTO_ACCESS: {
    name: 'SANDBOX_PROTO_ACCESS',
    message: 'Sandbox proto access',
    pattern: /Cannot read properties of undefined \(reading 'charAt'\)/i,
    category: 'sandbox_blocked',
    titleTemplate: "Cannot access property in sandbox mode",
    causes: [
      'Attempted to access **undefined variable** in sandbox mode',
      'Accessing properties on undefined in sandboxed template'
    ],
    fixCode: 'Define the variable in render context',
    fixComment: 'Pass the variable in the context object',
    subjectFrom: null
  },
  BLOCKED_CONTEXT_KEYS: {
    name: 'BLOCKED_CONTEXT_KEYS',
    message: 'Cannot use blocked keys in context: {keys}',
    pattern: /^Cannot use blocked keys in context: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contains **blocked keys** like __proto__',
      'Dangerous keys detected in render context'
    ],
    fixCode: 'Remove blocked keys from context',
    fixComment: 'Clean the context before passing to render',
    subjectFrom: null
  },
  DANGEROUS_CONTEXT_VALUES: {
    name: 'DANGEROUS_CONTEXT_VALUES',
    message: 'Context contains unsafe values: {values}',
    pattern: /^Context contains unsafe values: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contains **dangerous values** like eval or Function',
      'Potentially malicious functions in context'
    ],
    fixCode: 'Remove dangerous functions from context',
    fixComment: 'Clean the context before passing to render',
    subjectFrom: null
  },
  DANGEROUS_CONTEXT_VALUE_SCRUBBED: {
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: 'Scrubbed unsafe values from context: {values}',
    pattern: /^Scrubbed unsafe values from context: (.+)$/i,
    category: 'security_error',
    causes: [
      'Context contains **dangerous values** that were removed'
    ],
    fixCode: 'Remove dangerous functions from context',
    fixComment: 'Clean the context before passing to render',
    subjectFrom: null
  },
  DANGEROUS_TEMPLATE_CODE: {
    name: 'DANGEROUS_TEMPLATE_CODE',
    message: 'Template contains unsafe code: {violations}',
    pattern: /^Template contains unsafe code: (.+)$/i,
    category: 'security_error',
    causes: [
      'Template contains **dangerous code patterns**',
      'Attempted to access global objects'
    ],
    fixCode: 'Remove dangerous code from template',
    fixComment: 'Do not use eval, Function, or access global in templates',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type SandboxErrorName = keyof typeof SANDBOX_ERRORS;

import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';
import { SANDBOX_ERRORS } from './sandbox.ts';

describe('SANDBOX_ERRORS definitions', () => {
  test('each entry is keyed by its own name and carries guidance', () => {
    for (const [name, def] of Object.entries(SANDBOX_ERRORS)) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('scrubbed-values notice is the sole warning; the rest stay errors', () => {
    const warnings = Object.values(SANDBOX_ERRORS).filter((def) => def.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.name).toBe('DANGEROUS_CONTEXT_VALUE_SCRUBBED');
  });
});

describe('key-based access errors interpolate the blocked key', () => {
  test('SANDBOX_ACCESS classification substitutes the property into causes and fixComment', () => {
    const cls = classifyFromError({ message: "Cannot access '__proto__' in sandbox mode" });
    expect(cls.category).toBe('sandbox_blocked');
    expect(cls.causes.some((c) => c.includes('__proto__'))).toBe(true);
    expect(cls.fixComment).toContain('__proto__');
  });

  test('SANDBOX_SET classification substitutes the assigned key', () => {
    const cls = classifyFromError({ message: "Cannot set 'constructor' in sandbox mode" });
    expect(cls.category).toBe('sandbox_blocked');
    expect(cls.causes.some((c) => c.includes('constructor'))).toBe(true);
  });

  test('SANDBOX_ALLOWLIST classification substitutes the denied key into fixCode', () => {
    const cls = classifyFromError({
      message: "'fetch' is not allowed in sandbox mode. Add it to allowlist.",
    });
    expect(cls.category).toBe('sandbox_blocked');
    expect(cls.fixCode).toContain('"fetch"');
  });
});

describe('extraFrom-backed security errors', () => {
  test('BLOCKED_CONTEXT_KEYS surfaces the matched key list in causes and fixCode', () => {
    const cls = classifyFromError({
      message: 'Cannot use blocked keys in context: eval, Function',
    });
    expect(cls.category).toBe('security_error');
    expect(cls.causes.some((c) => c.includes('eval, Function'))).toBe(true);
    expect(cls.fixCode).toContain('eval, Function');
  });

  test('DANGEROUS_CONTEXT_VALUES renders the matched value list into the title', () => {
    const cls = classifyFromError({ message: 'Context contains unsafe values: eval' });
    expect(cls.category).toBe('security_error');
    expect(cls.title).toBe('Context contains unsafe values: eval');
  });

  test('DANGEROUS_CONTEXT_VALUE_SCRUBBED classifies as a warning notice', () => {
    const cls = classifyFromError({ message: 'Scrubbed unsafe values from context: process' });
    expect(cls.severity).toBe('warning');
    expect(cls.category).toBe('security_error');
  });

  test('DANGEROUS_TEMPLATE_CODE renders the matched violations into the title', () => {
    const cls = classifyFromError({ message: 'Template contains unsafe code: use of eval' });
    expect(cls.title).toBe('Template contains unsafe code: use of eval');
  });
});

describe('prototype and execution blocks', () => {
  test('SANDBOX_PROTO_ACCESS classifies as a security error', () => {
    expect(classifyFromError({ message: 'Sandbox prototype access blocked' }).category).toBe(
      'security_error'
    );
  });

  test('SANDBOX_CODE_EXECUTION and SANDBOX_TIMEOUT_EXEC map to their categories', () => {
    expect(classifyFromError({ message: 'Code execution is blocked' }).category).toBe(
      'sandbox_blocked'
    );
    expect(classifyFromError({ message: 'Sandbox timeout' }).category).toBe('timeout_error');
  });
});

import { describe, expect, test } from 'bun:test';
import { emitUndefinedWarning } from './warning-emitter.ts';

const emitterOptions = {
  name: 'UNDEFINED_VARIABLE',
  message: () => "Variable 'missing' is undefined or null",
  subject: 'missing',
  lineno: 4,
  colno: 9,
  phase: 'render' as const,
  templateName: 'diag.njk',
  mode: 'debug' as const,
  varName: 'missing',
};

describe('emitUndefinedWarning', () => {
  test('pushes a flat warning onto the attached collector', () => {
    const collector: unknown[] = [];
    emitUndefinedWarning({ __warnings__: collector }, emitterOptions);
    expect(collector).toHaveLength(1);
    const warning = collector[0] as Record<string, unknown>;
    expect(warning.message).toContain("'missing'");
    expect(warning.code).toBe('UNDEFINED_VARIABLE');
    expect(warning.templateName).toBe('diag.njk');
    expect(warning.varName).toBe('missing');
    expect(warning.undefinedMode).toBe('debug');
    expect(warning.lineno).toBe(4);
    expect(warning.lineBase).toBe('zero');
  });

  // WHY: console reassignment in try/finally is the sanctioned zero-mock shell-test
  // pattern (precedent: undefined-resolution.test.ts).
  test('falls back to console.warn when no collector is attached', () => {
    const original = console.warn;
    const received: string[] = [];
    console.warn = (message: string) => {
      received.push(message);
    };
    try {
      emitUndefinedWarning({}, emitterOptions);
    } finally {
      console.warn = original;
    }
    expect(received).toHaveLength(1);
    expect(received[0]).toContain("'missing'");
  });

  test('a non-array __warnings__ slot also falls back to console.warn', () => {
    const original = console.warn;
    let calls = 0;
    console.warn = () => {
      calls += 1;
    };
    try {
      emitUndefinedWarning({ __warnings__: 'not-an-array' }, emitterOptions);
    } finally {
      console.warn = original;
    }
    expect(calls).toBe(1);
  });
});

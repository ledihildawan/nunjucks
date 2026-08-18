import { describe, expect, test } from 'bun:test';
import type { BaseValidationError } from './validation-error.ts';

// WHY: this module is a type-only error envelope — the annotations below pin its shape at
// typecheck time, while the runtime expectations mirror them so failures surface in bun too.
describe('BaseValidationError', () => {
  test('requires only a message', () => {
    const error: BaseValidationError = { message: 'boom' };
    expect(error.message).toBe('boom');
  });

  test('accepts the fully populated envelope', () => {
    const error: BaseValidationError = {
      message: 'boom',
      code: 'UNSAFE_PROPERTY',
      subject: 'eval',
      lineno: 3,
      colno: 7,
    };
    expect(error.code).toBe('UNSAFE_PROPERTY');
    expect(error.subject).toBe('eval');
    expect(error.lineno).toBe(3);
    expect(error.colno).toBe(7);
  });

  test('each optional field may be omitted independently', () => {
    const withCode: BaseValidationError = { message: 'm', code: 'c' };
    const withSubject: BaseValidationError = { message: 'm', subject: 's' };
    const withPosition: BaseValidationError = { message: 'm', lineno: 1, colno: 2 };
    expect(withCode.code).toBe('c');
    expect(withSubject.subject).toBe('s');
    expect(withPosition.lineno).toBe(1);
    expect(withPosition.colno).toBe(2);
  });

  // WHY: line/column zero is a legitimate source position (ZERO_LOC), not "absent".
  test('positions tolerate zero', () => {
    const error: BaseValidationError = { message: 'm', lineno: 0, colno: 0 };
    expect(error.lineno).toBe(0);
    expect(error.colno).toBe(0);
  });
});

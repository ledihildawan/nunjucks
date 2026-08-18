import { describe, expect, test } from 'bun:test';
import { TEMPLATE_ERROR } from './branding.ts';
import { createInternalInvariantError, isInternalInvariantError } from './internal-invariant.ts';

describe('createInternalInvariantError', () => {
  test('brands the error and prefixes the message', () => {
    const error = createInternalInvariantError('pushToken double push');
    expect(isInternalInvariantError(error)).toBe(true);
    expect(error.message).toBe('internal invariant violated: pushToken double push');
  });

  test('is an Error instance with a stack trace', () => {
    const error = createInternalInvariantError('probe');
    expect(error instanceof Error).toBe(true);
    expect(typeof error.stack).toBe('string');
  });

  test('is NOT template-branded, so Result boundaries keep propagating it as a bug', () => {
    const error = createInternalInvariantError('probe') as unknown as {
      [TEMPLATE_ERROR]?: unknown;
    };
    expect(error[TEMPLATE_ERROR]).toBeUndefined();
  });

  test('narrowing rejects plain errors and non-objects', () => {
    expect(isInternalInvariantError(new Error('plain'))).toBe(false);
    expect(isInternalInvariantError(null)).toBe(false);
    expect(isInternalInvariantError('internal invariant violated: x')).toBe(false);
  });
});

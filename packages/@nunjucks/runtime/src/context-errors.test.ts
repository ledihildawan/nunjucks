import { describe, expect, test } from 'bun:test';
import {
  throwBlockNotFoundError,
  throwBlockNotFunctionError,
  throwNoSuperBlockError,
} from './context-errors.ts';

interface ThrownTemplateError {
  code: string | null;
  message: string;
  subject: string | null;
  lineno: number | null;
  colno: number | null;
  phase: string | null;
}

const captureThrown = (thrower: () => never): ThrownTemplateError => {
  try {
    thrower();
  } catch (thrown: unknown) {
    return thrown as ThrownTemplateError;
  }
};

describe('throwBlockNotFoundError', () => {
  test('throws UNDEFINED_BLOCK naming the block as subject', () => {
    const thrown = captureThrown(() =>
      throwBlockNotFoundError({ name: 'content', location: undefined, lineno: null, colno: null })
    );
    expect(thrown.code).toBe('UNDEFINED_BLOCK');
    expect(thrown.message).toContain('content');
    expect(thrown.phase).toBe('render');
  });

  test('prefers explicit lineno/colno over the stored block location', () => {
    const thrown = captureThrown(() =>
      throwBlockNotFoundError({
        name: 'content',
        location: { lineno: 7, colno: 3 },
        lineno: 12,
        colno: 5,
      })
    );
    expect(thrown.lineno).toBe(12);
    expect(thrown.colno).toBe(5);
  });

  test('falls back to the stored block location when explicit line data is null', () => {
    const thrown = captureThrown(() =>
      throwBlockNotFoundError({
        name: 'content',
        location: { lineno: 7, colno: 3 },
        lineno: null,
        colno: null,
      })
    );
    expect(thrown.lineno).toBe(7);
    expect(thrown.colno).toBe(3);
  });

  test('tolerates a missing location entirely', () => {
    const thrown = captureThrown(() =>
      throwBlockNotFoundError({ name: 'content', location: undefined, lineno: null, colno: null })
    );
    expect(thrown.lineno).toBeNull();
    expect(thrown.colno).toBeNull();
  });
});

describe('throwBlockNotFunctionError', () => {
  test('throws NOT_A_FUNCTION naming the block', () => {
    const thrown = captureThrown(() => throwBlockNotFunctionError({ name: 'sidebar' }));
    expect(thrown.code).toBe('NOT_A_FUNCTION');
    expect(thrown.message).toContain('sidebar');
    expect(thrown.phase).toBe('render');
  });
});

describe('throwNoSuperBlockError', () => {
  test('throws NO_SUPER_BLOCK with the supplied location intact', () => {
    const thrown = captureThrown(() =>
      throwNoSuperBlockError({ name: 'header', lineno: 4, colno: 9 })
    );
    expect(thrown.code).toBe('NO_SUPER_BLOCK');
    expect(thrown.message).toContain('super');
    expect(thrown.subject).toBe('header');
    expect(thrown.lineno).toBe(4);
    expect(thrown.colno).toBe(9);
  });

  test('passes null location through without defaulting', () => {
    const thrown = captureThrown(() =>
      throwNoSuperBlockError({ name: 'header', lineno: null, colno: null })
    );
    expect(thrown.lineno).toBeNull();
    expect(thrown.colno).toBeNull();
  });
});

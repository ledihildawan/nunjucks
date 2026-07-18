import { describe, test, expect } from 'bun:test';
import { prettifyError } from './template-error.ts';

describe('prettifyError', () => {
  test('applies zero-based locations as one-based display text', () => {
    const err = new Error('Boom') as Error & { lineno: number; colno: number; lineBase: 'zero' | 'one' };
    err.lineno = 1;
    err.colno = 3;
    err.lineBase = 'zero';

    const pretty = prettifyError({
      path: 'child.njk',
      withInternals: false,
      err
    });

    expect(pretty.message).toContain('(child.njk) [Line 2, Column 4]');
    expect(pretty.message).toContain('Boom');
  });

  test('preserves one-based locations without shifting them again', () => {
    const err = new Error('Boom') as Error & { lineno: number; colno: number; lineBase: 'zero' | 'one' };
    err.lineno = 5;
    err.colno = 8;
    err.lineBase = 'one';

    const pretty = prettifyError({
      path: 'mapped.njk',
      withInternals: false,
      err
    });

    expect(pretty.message).toContain('(mapped.njk) [Line 5, Column 8]');
  });

  test('includes include-chain context when available', () => {
    const err = new Error('Boom') as Error & { lineno: number; colno: number; lineBase: 'zero' | 'one' };
    err.lineno = 0;
    err.colno = 0;
    err.lineBase = 'zero';

    const pretty = prettifyError({
      path: 'partial.njk',
      withInternals: false,
      err,
      includeChain: {
        parentTmpl: 'page.njk',
        parentLineno: 12,
        parentColno: 4
      }
    });

    expect(pretty.message).toContain('included from page.njk:12:4');
  });
});

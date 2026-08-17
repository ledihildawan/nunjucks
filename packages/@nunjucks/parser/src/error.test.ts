import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr } from '@nunjucks/lib';
import type { ParserContext } from './cursor.ts';
import { peekTokenOrNull } from './cursor.ts';
import { error, errorAt, fail } from './error.ts';

const makeCtx = (src: string): ParserContext => {
  const tk = createTokenizer(src);
  return {
    tokens: tk,
    peeked: null,
    dropLeadingWhitespace: false,
    extensions: [],
  };
};

describe('error: cause inference', () => {
  test('expected-expression messages map to the missing-expression causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'expected expression, got end' });
    expect(errObj.causes).toEqual([
      'Missing expression where one is required',
      'Check for empty `{{ }}` or `{% %}` blocks',
    ]);
  });

  test('expected-end messages map to the unclosed-tag causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'expected block end' });
    expect(errObj.causes).toEqual([
      '**Unclosed tag** - missing `{% end... %}`',
      'Check that all block tags have matching closing tags',
    ]);
  });

  test('expected-comma messages map to the missing-comma causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'expected , got }' });
    expect(errObj.causes).toEqual([
      '**Missing comma** between values',
      'Array/object literals require commas between elements',
    ]);
  });

  test('unknown-block messages map to the tag-typo causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'unknown block tag: iffoo' });
    expect(errObj.causes).toEqual([
      '**Typo** in block tag name',
      'Block tag is not registered or not yet supported',
    ]);
  });

  test('expected-in messages map to the for-loop causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'expected in after loop variable' });
    expect(errObj.causes).toEqual([
      '**For loop** missing `in` keyword',
      'Use correct syntax: `{% for item in items %}`',
    ]);
  });

  test('variable-name messages map to the invalid-identifier causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'variable name expected' });
    expect(errObj.causes).toEqual([
      '**Invalid identifier** used as variable name',
      'Variable names must start with letter/underscore',
    ]);
  });

  test('messages matching no pattern fall back to the default causes', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'something entirely unprecedented' });
    expect(errObj.causes).toEqual([
      'Check **template syntax** at the error location',
      'Compare with the **documentation** examples',
    ]);
  });
});

describe('error: fix inference', () => {
  test('expected-expression messages suggest an expression placeholder', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'expected expression, got end' }).fixCode).toBe(
      '{{ someExpression }}'
    );
  });

  test('unknown-block messages suggest a well-known block tag', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'unknown block tag: iffoo' }).fixCode).toBe(
      '{% if condition %}...{% endif %}'
    );
  });

  test('expected-in messages suggest a complete for loop', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'expected in after loop variable' }).fixCode).toBe(
      '{% for item in items %}...{% endfor %}'
    );
  });

  test('expected-comma messages suggest commaed literals', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'expected , got }' }).fixCode).toBe(
      '{{ [1, 2, 3] }} or {{ {a: 1, b: 2} }}'
    );
  });

  test('messages matching no pattern fall back to the default fix', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'something entirely unprecedented' }).fixCode).toBe(
      'Check template syntax around the error location'
    );
  });
});

describe('error: location resolution', () => {
  test('missing options resolve lineno/colno from the peeked token', () => {
    const ctx = makeCtx('{{ x }}');
    const peeked = peekTokenOrNull(ctx);
    expect(peeked).not.toBeNull();
    const errObj = error(ctx, { message: 'boom' });
    expect(errObj.lineno).toBe(peeked?.lineno ?? null);
    expect(errObj.colno).toBe(peeked?.colno ?? null);
  });

  test('explicit options win over the peeked token location', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'boom', lineno: 12, colno: 34 });
    expect(errObj.lineno).toBe(12);
    expect(errObj.colno).toBe(34);
  });

  test('exhausted input resolves to the zero location', () => {
    const errObj = error(makeCtx(''), { message: 'boom' });
    expect(errObj.lineno).toBe(0);
    expect(errObj.colno).toBe(0);
  });
});

describe('error: log shape and sentinel', () => {
  test('carries the parser code, message, and parse-phase context', () => {
    const errObj = error(makeCtx('{{ x }}'), { message: 'boom', lineno: 1, colno: 2 });
    expect(errObj.code).toBe('PARSER_ERROR');
    expect(errObj.message).toBe('boom');
    expect(errObj.phase).toBe('parse');
    expect(errObj.lineBase).toBe('zero');
  });

  test('attaches the sentinel only when provided', () => {
    expect(error(makeCtx('{{ x }}'), { message: 'boom', sentinel: 'END_IF' })).toMatchObject({
      sentinel: 'END_IF',
    });
    expect('sentinel' in error(makeCtx('{{ x }}'), { message: 'boom' })).toBe(false);
  });
});

describe('fail', () => {
  test('returns an Err Result wrapping the same parser error', () => {
    const result = fail(makeCtx('{{ x }}'), {
      message: 'expected expression, got end',
      lineno: 4,
      colno: 5,
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) {
      return;
    }
    expect(result.error.code).toBe('PARSER_ERROR');
    expect(result.error.message).toBe('expected expression, got end');
    expect(result.error.causes).toContain('Missing expression where one is required');
    expect(result.error.lineno).toBe(4);
    expect(result.error.colno).toBe(5);
  });
});

describe('errorAt', () => {
  test('returns an Err Result with the definition code, subject, and location', () => {
    const result = errorAt({
      lineno: 9,
      colno: 11,
      errorDef: {
        name: 'WALRUS_TARGET_TEST',
        message: 'cannot assign to this target',
        pattern: /^cannot assign to this target$/u,
      },
      subject: 'target',
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) {
      return;
    }
    expect(result.error.code).toBe('WALRUS_TARGET_TEST');
    expect(result.error.message).toBe('cannot assign to this target');
    expect(result.error.subject).toBe('target');
    expect(result.error.lineno).toBe(9);
    expect(result.error.colno).toBe(11);
    expect(result.error.phase).toBe('parse');
  });

  test('coerces non-string extra params so the definition message can interpolate them', () => {
    const result = errorAt({
      lineno: 1,
      colno: 1,
      errorDef: {
        name: 'COUNT_TEST',
        message: 'got {count} items',
        pattern: /^got (\d+) items$/u,
      },
      extra: { count: 3 },
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) {
      return;
    }
    expect(result.error.message).toBe('got 3 items');
  });

  test('defaults the subject to null when omitted', () => {
    const result = errorAt({
      lineno: 1,
      colno: 1,
      errorDef: {
        name: 'NO_SUBJECT_TEST',
        message: 'no subject here',
        pattern: /^no subject here$/u,
      },
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) {
      return;
    }
    expect(result.error.subject).toBe(null);
  });
});

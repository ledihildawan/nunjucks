import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeTemplateLiteral } from './template-literal.ts';

interface TemplateValue {
  quasis: Array<{ type: string; value: string }>;
  expressions: unknown[];
}

const run = (src: string) => tokenizeTemplateLiteral({ ...createState(src), inCode: true });

const quasisOf = (r: ReturnType<typeof run>): TemplateValue['quasis'] => {
  if (!r) {
    throw new Error('null result');
  }
  return (r.token.value as TemplateValue).quasis;
};

describe('tokenizeTemplateLiteral', () => {
  test('returns null for non-backtick', () => {
    expect(run('abc')).toBeNull();
  });

  test('simple literal', () => {
    const r = run('`hello`');
    expect(r?.token.type).toBe('template-literal');
    expect(quasisOf(r)).toHaveLength(1);
  });

  test('with interpolation', () => {
    const r = run('`a$' + '{x}b`');
    const q = quasisOf(r);
    expect(q).toHaveLength(3);
    expect(q[1]?.type).toBe('expression');
    expect(q[1]?.value).toBe('x');
  });

  test('expressions field is always empty array', () => {
    const r = run('`x`');
    if (!r) {
      throw new Error('null');
    }
    expect((r.token.value as TemplateValue).expressions).toEqual([]);
  });

  test('nested braces in interpolation', () => {
    const r = run('`$' + '{ {a:1} }`');
    const q = quasisOf(r);
    expect(q[0]?.type).toBe('expression');
  });

  test('throws on backtick inside interpolation', () => {
    expect(() => run('`$' + '{`inner`}')).toThrow(/backtick/);
  });

  test('unterminated template literal throws UNTERMINATED_LITERAL', () => {
    expect(() => run('`no close')).toThrow(/Unterminated template literal/);
  });

  test('EOF inside an interpolation throws UNTERMINATED_LITERAL', () => {
    expect(() => run('`a$' + '{expr')).toThrow(/Unterminated template literal/);
  });
});

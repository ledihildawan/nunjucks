import { describe, expect, test } from 'bun:test';
import { isErr } from '@nunjucks/lib';
import { parse } from './index.ts';

// WHY: tag names and operator spellings are template-controlled text. Before the
// Map-based dispatch tables, `{% __proto__ %}` resolved Object.prototype through the
// plain-object registry and escaped parse()'s Result boundary as a raw TypeError,
// while `constructor` resolved inherited CALLABLES — `{% constructor %}` dispatched
// Object.prototype.constructor and `{{ 1 constructor 2 }}` silently injected a
// non-Node into the AST. These tests pin the fail-closed behavior.
describe('prototype-chain dispatch safety', () => {
  test('`{% __proto__ %}` fails as an unknown block tag inside the Result boundary', () => {
    const result = parse('{% __proto__ %}');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(String(result.error.message)).toContain('unknown block tag');
    }
  });

  test('`{% constructor %}` fails as an unknown block tag instead of dispatching a callable', () => {
    const result = parse('{% constructor %}');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(String(result.error.message)).toContain('unknown block tag');
    }
  });

  test('`{% toString %}` fails as an unknown block tag', () => {
    const result = parse('{% toString %}');
    expect(isErr(result)).toBe(true);
  });

  test('symbol text `constructor` in bitwise position cannot inject Object.prototype.constructor', () => {
    const result = parse('{{ 1 constructor 2 }}');
    expect(isErr(result)).toBe(true);
  });

  test('legitimate statement tags still dispatch after the Map conversion', () => {
    const result = parse('{% if true %}yes{% endif %}');
    expect(isErr(result)).toBe(false);
  });
});

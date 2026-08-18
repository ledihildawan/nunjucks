import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseExpression } from './index.ts';

const parse = (src: string): Node => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return unwrap(parseExpression(ctx));
};

const parseResult = (src: string): Result<Node, TemplateError> => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return parseExpression(ctx);
};

const opsOf = (node: Node): readonly Node[] => (node as { ops: readonly Node[] }).ops;

describe('parseCompare: comparison operators', () => {
  test.each([['=='], ['==='], ['!='], ['!=='], ['<'], ['>'], ['<='], ['>=']])(
    '%s wraps the operands in a compare node',
    (operator) => {
      const node = parse(`a ${operator} b`);
      expect(getNodeTypeName(node)).toBe('compare');
      expect(getNodeTypeName((node as { expr: Node }).expr)).toBe('symbol');
      const ops = opsOf(node);
      expect(ops).toHaveLength(1);
      expect(getNodeTypeName(ops[0] as Node)).toBe('compareOperand');
      expect((ops[0] as { operator: string }).operator).toBe(operator);
      expect(getNodeTypeName((ops[0] as { expr: Node }).expr)).toBe('symbol');
    }
  );

  test('a lone expression is returned unwrapped', () => {
    expect(getNodeTypeName(parse('a'))).toBe('symbol');
    expect(getNodeTypeName(parse('a + b'))).toBe('add');
  });

  test('a chained comparison collects one compareOperand per operator', () => {
    const node = parse('a < b < c');
    const ops = opsOf(node);
    expect(ops).toHaveLength(2);
    expect((ops[0] as { operator: string }).operator).toBe('<');
    expect((ops[1] as { operator: string }).operator).toBe('<');
    expect((ops[1] as { expr: Node }).expr.value).toBe('c');
  });

  test('a mixed chain preserves each operator in order', () => {
    const node = parse('a < b <= c');
    const ops = opsOf(node);
    expect((ops[0] as { operator: string }).operator).toBe('<');
    expect((ops[1] as { operator: string }).operator).toBe('<=');
  });

  test('comparison binds looser than arithmetic on both sides', () => {
    const node = parse('1 + 2 < 4 * 5');
    expect(getNodeTypeName((node as { expr: Node }).expr)).toBe('add');
    expect(getNodeTypeName((opsOf(node)[0] as { expr: Node }).expr)).toBe('mul');
  });

  test('a dangling comparison operator is an error', () => {
    expect(isErr(parseResult('a <'))).toBe(true);
  });
});

describe('parseIs: `is` tests', () => {
  test.each([['defined'], ['even'], ['string'], ['boolean'], ['empty']])(
    'x is %s produces a test node naming the test',
    (name) => {
      const node = parse(`x is ${name}`);
      expect(getNodeTypeName(node)).toBe('test');
      expect((node as { name: string }).name).toBe(name);
      expect(getNodeTypeName((node as { target: Node }).target)).toBe('symbol');
    }
  );

  test('x is none keeps the none test distinct from null', () => {
    expect((parse('x is none') as { name: string }).name).toBe('none');
  });

  test('x is null keeps the strict-null test distinct from none', () => {
    expect((parse('x is null') as { name: string }).name).toBe('null');
  });

  test('boolean keywords after `is` act as test names', () => {
    const node = parse('x is true');
    expect(getNodeTypeName(node)).toBe('test');
    expect((node as { name: string }).name).toBe('true');
  });

  test('x is not defined negates the test node', () => {
    const node = parse('x is not defined');
    expect(getNodeTypeName(node)).toBe('not');
    const inner = (node as { target: Node }).target;
    expect(getNodeTypeName(inner)).toBe('test');
    expect((inner as { name: string }).name).toBe('defined');
  });

  test('a test with parenthesized arguments produces a testCall', () => {
    const node = parse('x is divisibleby(3)');
    expect(getNodeTypeName(node)).toBe('testCall');
    expect((node as { name: string }).name).toBe('divisibleby');
    const args = (node as { args: readonly Node[] }).args;
    expect(args).toHaveLength(1);
    expect((args[0] as Node).value).toBe(3);
  });

  test('a testCall keeps multiple positional arguments', () => {
    const node = parse('x is between(1, 5)');
    expect((node as { args: readonly Node[] }).args).toHaveLength(2);
  });

  test('`is` with a non-test right operand falls back to a binary is node', () => {
    const node = parse('x is y');
    expect(getNodeTypeName(node)).toBe('is');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('symbol');
    expect(getNodeTypeName((node as { right: Node }).right)).toBe('symbol');
  });

  test('`is not` with a non-test operand negates the binary is node', () => {
    const node = parse('x is not y');
    expect(getNodeTypeName(node)).toBe('not');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('is');
  });

  test('`is` binds looser than comparisons, wrapping the chain as its target', () => {
    const node = parse('a < b is boolean');
    expect(getNodeTypeName(node)).toBe('test');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('compare');
  });
});

describe('parseIn: membership operators', () => {
  test('x in arr produces an in node', () => {
    const node = parse('x in arr');
    expect(getNodeTypeName(node)).toBe('in');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('symbol');
    expect(getNodeTypeName((node as { right: Node }).right)).toBe('symbol');
  });

  test('x not in arr negates the in node', () => {
    const node = parse('x not in arr');
    expect(getNodeTypeName(node)).toBe('not');
    const inner = (node as { target: Node }).target;
    expect(getNodeTypeName(inner)).toBe('in');
    expect(getNodeTypeName((inner as { left: Node }).left)).toBe('symbol');
  });

  test('membership chains fold left-associatively', () => {
    const node = parse('a in b in c');
    expect(getNodeTypeName(node)).toBe('in');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('in');
  });

  test('prefix not applies to the whole membership test', () => {
    const node = parse('not a in b');
    expect(getNodeTypeName(node)).toBe('not');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('in');
  });

  test('the right operand parses a full expression', () => {
    const node = parse('a in [1, 2]');
    expect(getNodeTypeName((node as { right: Node }).right)).toBe('array');
  });

  test('`in` binds looser than bitwise or', () => {
    const node = parse('a | b in c');
    expect(getNodeTypeName(node)).toBe('in');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('bitwiseOr');
  });

  test('a dangling `in` with no right operand is an error', () => {
    expect(isErr(parseResult('a in'))).toBe(true);
  });
});

describe('parseBitwiseOr: bitwise operators', () => {
  test.each([
    ['|', 'bitwiseOr'],
    ['&', 'bitwiseAnd'],
    ['^', 'bitwiseXor'],
    ['<<', 'bitwiseLShift'],
    ['>>', 'bitwiseRShift'],
  ])('%s produces a %s node with left and right', (operator, expected) => {
    const node = parse(`a ${operator} b`);
    expect(getNodeTypeName(node)).toBe(expected);
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('symbol');
    expect(getNodeTypeName((node as { right: Node }).right)).toBe('symbol');
  });

  // WHY: pins current single-shot behavior — parseBitwiseOr consumes at most one
  // operator, so `a | b | c` parses as `a | b` and silently drops `| c` (suspected
  // bug: every other binary level folds, this one does not; see comparison.ts).
  test('a second bitwise operator is not folded into the node', () => {
    const node = parse('a | b | c');
    expect(getNodeTypeName(node)).toBe('bitwiseOr');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('symbol');
    expect(getNodeTypeName((node as { right: Node }).right)).toBe('symbol');
  });
});

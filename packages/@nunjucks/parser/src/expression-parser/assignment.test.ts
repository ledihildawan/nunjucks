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

const childOf = (n: Node, i = 0): Node => (n as { children: readonly Node[] }).children[i] as Node;
const targetOf = (n: Node): Node => (n as { target: Node }).target;
const valueField = (n: Node): Node => (n as { value: Node }).value;

describe('parseWalrus: := on a symbol target', () => {
  test('statement-level := produces a variableDeclaration with symbol target and value', () => {
    const node = parse('x := 1');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    const targets = (node as { targets: readonly Node[] }).targets;
    expect(targets).toHaveLength(1);
    expect(getNodeTypeName(targets[0] as Node)).toBe('symbol');
    expect((targets[0] as Node).value).toBe('x');
    expect(getNodeTypeName(valueField(node))).toBe('literal');
    expect(valueField(node).value).toBe(1);
  });

  test(':= before ) stays in expression position and produces a walrus', () => {
    const node = parse('(x := 1)');
    expect(getNodeTypeName(node)).toBe('group');
    const walrusNode = childOf(node);
    expect(getNodeTypeName(walrusNode)).toBe('walrus');
    expect(getNodeTypeName(targetOf(walrusNode))).toBe('symbol');
    expect((targetOf(walrusNode) as Node).value).toBe('x');
    expect(getNodeTypeName(valueField(walrusNode))).toBe('literal');
  });

  test(':= before , inside call arguments produces a walrus', () => {
    const node = parse('f(x := 1, 2)');
    expect(getNodeTypeName(node)).toBe('funCall');
    const args = (node as { args: readonly Node[] }).args;
    expect(getNodeTypeName(args[0] as Node)).toBe('walrus');
    expect(getNodeTypeName(args[1] as Node)).toBe('literal');
  });

  test(':= as the last call argument produces a walrus', () => {
    const node = parse('f(x := 1)');
    const args = (node as { args: readonly Node[] }).args;
    expect(getNodeTypeName(args[0] as Node)).toBe('walrus');
  });

  test('the walrus value parses a full arithmetic expression', () => {
    const node = parse('x := 1 + 2 * 3');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    expect(getNodeTypeName(valueField(node))).toBe('add');
    expect(getNodeTypeName((valueField(node) as { right: Node }).right)).toBe('mul');
  });

  test('the walrus value consumes |> pipe-forward filters', () => {
    const node = parse('x := 1 |> double');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    expect(getNodeTypeName(valueField(node))).toBe('pipe');
  });

  test('a walrus followed by , inside an array literal stays a walrus', () => {
    const node = parse('[x := 1, y := 2]');
    expect(getNodeTypeName(node)).toBe('array');
    expect(getNodeTypeName(childOf(node))).toBe('walrus');
  });

  // WHY: pins current behavior of the following-token heuristic — `]` is not treated
  // as expression context, so the last element degrades to a variableDeclaration
  // inside an array literal (suspected bug, see assignment.ts isExpressionContext).
  test('a walrus followed by ] inside an array literal degrades to a variableDeclaration', () => {
    const node = parse('[x := 1]');
    expect(getNodeTypeName(node)).toBe('array');
    expect(getNodeTypeName(childOf(node))).toBe('variableDeclaration');
  });
});

describe('parseWalrus: destructuring targets', () => {
  test('[a, b] := v produces an arrayPattern target on a variableDeclaration', () => {
    const node = parse('[a, b] := v');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    const pattern = (node as { targets: readonly Node[] }).targets[0] as Node;
    expect(getNodeTypeName(pattern)).toBe('arrayPattern');
    const children = (pattern as { children: readonly Node[] }).children;
    expect(getNodeTypeName(children[0] as Node)).toBe('symbol');
    expect(getNodeTypeName(children[1] as Node)).toBe('symbol');
    expect(getNodeTypeName(valueField(node))).toBe('symbol');
    expect(valueField(node).value).toBe('v');
  });

  test('array spread in a walrus target normalizes to a restPattern', () => {
    const node = parse('[a, ...r] := v');
    const pattern = (node as { targets: readonly Node[] }).targets[0] as Node;
    const children = (pattern as { children: readonly Node[] }).children;
    expect(getNodeTypeName(children[1] as Node)).toBe('restPattern');
    expect((children[1] as Node).value).toBeUndefined();
    expect(getNodeTypeName(targetOf(children[1] as Node))).toBe('symbol');
  });

  test('({a, b} := v) produces a walrus over an objectPattern of patternProperties', () => {
    const node = parse('({a, b} := v)');
    expect(getNodeTypeName(node)).toBe('group');
    const walrusNode = childOf(node);
    expect(getNodeTypeName(walrusNode)).toBe('walrus');
    const pattern = targetOf(walrusNode);
    expect(getNodeTypeName(pattern)).toBe('objectPattern');
    const children = (pattern as { children: readonly Node[] }).children;
    expect(getNodeTypeName(children[0] as Node)).toBe('patternProperty');
    expect((children[0] as { key: Node | string }).key).toBe('a');
    expect(getNodeTypeName(valueField(children[0] as Node))).toBe('symbol');
    expect(getNodeTypeName(valueField(walrusNode))).toBe('symbol');
  });

  test('statement-level {a, b} := v keeps the objectPattern on a variableDeclaration', () => {
    const node = parse('{a, b} := v');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    const pattern = (node as { targets: readonly Node[] }).targets[0] as Node;
    expect(getNodeTypeName(pattern)).toBe('objectPattern');
    expect((pattern as { children: readonly Node[] }).children).toHaveLength(2);
  });
});

describe('parseWalrus: compound assignment operators', () => {
  test.each([['+='], ['-='], ['*='], ['/='], ['//='], ['%='], ['**='], ['||='], ['&&='], ['??=']])(
    '%s produces a compoundAssignment preserving the operator',
    (operator) => {
      const node = parse(`x ${operator} 2`);
      expect(getNodeTypeName(node)).toBe('compoundAssignment');
      expect((node as { operator: string }).operator).toBe(operator);
      const targets = (node as { targets: readonly Node[] }).targets;
      expect(getNodeTypeName(targets[0] as Node)).toBe('symbol');
      expect(getNodeTypeName((node as { value: Node }).value)).toBe('literal');
    }
  );

  test('|>= pipe-forward compound assignment is recognized', () => {
    const node = parse('x |>= f');
    expect(getNodeTypeName(node)).toBe('compoundAssignment');
    expect((node as { operator: string }).operator).toBe('|>=');
    expect(getNodeTypeName((node as { value: Node }).value)).toBe('symbol');
  });

  test('the compound value parses a full expression', () => {
    const node = parse('x += 1 + 2');
    expect(getNodeTypeName(node)).toBe('compoundAssignment');
    expect(getNodeTypeName((node as { value: Node }).value)).toBe('add');
  });
});

describe('parseWalrus: invalid targets and dangling values', () => {
  test('a member-access walrus target is rejected', () => {
    const result = parseResult('(a.b := 1)');
    expect(isErr(result)).toBe(true);
  });

  test('a member-access compound target is rejected', () => {
    const result = parseResult('a.b += 1');
    expect(isErr(result)).toBe(true);
  });

  test('a parenthesized pair target is rejected for :=', () => {
    const result = parseResult('((a, b) := v)');
    expect(isErr(result)).toBe(true);
  });

  test('a literal walrus target is rejected', () => {
    const result = parseResult('(1 := x)');
    expect(isErr(result)).toBe(true);
  });

  test('a dangling := with no value is an error', () => {
    const result = parseResult('x :=');
    expect(isErr(result)).toBe(true);
  });

  // WHY: parity with Python — unparenthesized chained walrus is not valid syntax;
  // the value parses at `or` level so the following `:=` is left unconsumed.
  test('unparenthesized chained walrus is an error', () => {
    const result = parseResult('x := y := 1');
    expect(isErr(result)).toBe(true);
  });
});

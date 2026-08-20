import { describe, expect, test } from 'bun:test';
import type { Node } from '@nunjucks/nodes';
import { parse } from './index.ts';
import { unwrap } from './test-helpers.ts';

// WHY: deep-chain regression suite — every flat chain in the grammar (binary folds,
// postfix segments, compare/in/not/prefix operators, ternaries, elif/when/case
// branches, argument and pattern lists) is parsed iteratively. Pre-fix, each of
// these recursed once per segment: on V8 (no tail calls) every test below threw
// `RangeError: Maximum call stack size exceeded` at these lengths, and on Bun/JSC
// the non-tail recursions (`in`, `not`, prefix operators, `elif`) still threw at
// their BUN_FAIL_LENGTHs. Lengths are sized to fail-before on V8 (all) and Bun
// (the non-tail subset) while keeping each test comfortably under 1s post-fix.
const N = 20_000;
const BUN_FAIL_LENGTH = 50_000;
const BUN_FAIL_LENGTH_ELIF = 30_000;

const leftOf = (node: Node): Node => (node as { left: Node }).left;
const targetOf = (node: Node): Node => (node as { target: Node }).target;
const alternateOf = (node: Node): Node | null => (node as { alternate: Node | null }).alternate;
const childrenOf = (node: Node): readonly Node[] =>
  (node as { children: readonly Node[] }).children;
const argsOf = (node: Node): readonly Node[] => (node as { args: readonly Node[] }).args;
const valueOfNode = (node: Node): unknown => (node as { value: unknown }).value;

const parseOutputExpression = (source: string): Node => {
  const result = parse(`{{ ${source} }}`);
  const output = unwrap(result).children[0];
  const expression = childrenOf(output as Node)[0];
  return expression as Node;
};

const parseStatement = (source: string): Node => unwrap(parse(source)).children[0] as Node;

const expectSymbol = (node: Node, name: string): void => {
  expect(node.type).toBe('symbol');
  expect(valueOfNode(node)).toBe(name);
};

describe('deep chains: binary and postfix expression folds', () => {
  test(`add chain with ${N} operators folds left-associatively`, () => {
    let node = parseOutputExpression(`a${'+a'.repeat(N)}`);
    for (let i = 0; i < N; i++) {
      expect(node.type).toBe('add');
      node = leftOf(node);
    }
    expectSymbol(node, 'a');
  });

  test(`member chain with ${N} segments keeps the base at the innermost target`, () => {
    let node = parseOutputExpression(`a${'.b'.repeat(N)}`);
    for (let i = 0; i < N; i++) {
      expect(node.type).toBe('lookupVal');
      node = targetOf(node);
    }
    expectSymbol(node, 'a');
  });

  test(`comparison chain with ${N} operators stays one flat compare node`, () => {
    const node = parseOutputExpression(`a${' < b'.repeat(N)}`);
    expect(node.type).toBe('compare');
    const ops = (node as { ops: readonly Node[] }).ops;
    expect(ops.length).toBe(N);
  });

  test(`pipe-forward chain with ${N} filters threads the value left-to-right`, () => {
    let node = parseOutputExpression(`a${' |> f'.repeat(N)}`);
    for (let i = 0; i < N; i++) {
      expect(node.type).toBe('pipe');
      node = argsOf(node)[0] as Node;
    }
    expectSymbol(node, 'a');
  });

  test(`ternary chain with ${N} questions nests through cond`, () => {
    let node = parseOutputExpression(`a${' ? a : a'.repeat(N)}`);
    for (let i = 0; i < N; i++) {
      expect(node.type).toBe('inlineIf');
      node = (node as { cond: Node }).cond;
    }
    expectSymbol(node, 'a');
  });

  test(`dotted filter name with ${N} dots parses as one symbol`, () => {
    const node = parseOutputExpression(`a |> f${'.g'.repeat(N)}`);
    expect(node.type).toBe('pipe');
    expectSymbol((node as { name: Node }).name, `f${'.g'.repeat(N)}`);
  });

  test(`call with ${N + 1} arguments collects every argument`, () => {
    const node = parseOutputExpression(`f(${'a,'.repeat(N)}a)`);
    expect(node.type).toBe('funCall');
    expect(argsOf(node).length).toBe(N + 1);
  });

  test(`optional call with ${N + 1} arguments collects every argument`, () => {
    const node = parseOutputExpression(`a?.(${'a,'.repeat(N)}a)`);
    expect(node.type).toBe('optionalCall');
    expect(argsOf(node).length).toBe(N + 1);
  });
});

describe('deep chains: non-tail recursions that overflowed on Bun itself', () => {
  test(`in chain with ${BUN_FAIL_LENGTH} segments folds left-associatively`, () => {
    let node = parseOutputExpression(`a${' in a'.repeat(BUN_FAIL_LENGTH)}`);
    for (let i = 0; i < BUN_FAIL_LENGTH; i++) {
      expect(node.type).toBe('in');
      node = leftOf(node);
    }
    expectSymbol(node, 'a');
  });

  test(`not chain with ${BUN_FAIL_LENGTH} negations wraps inward`, () => {
    let node = parseOutputExpression(`${'!'.repeat(BUN_FAIL_LENGTH)}a`);
    for (let i = 0; i < BUN_FAIL_LENGTH; i++) {
      expect(node.type).toBe('not');
      node = targetOf(node);
    }
    expectSymbol(node, 'a');
  });

  test(`prefix operator chain with ${BUN_FAIL_LENGTH} minuses wraps inward`, () => {
    let node = parseOutputExpression(`${'- '.repeat(BUN_FAIL_LENGTH)}a`);
    for (let i = 0; i < BUN_FAIL_LENGTH; i++) {
      expect(node.type).toBe('neg');
      node = targetOf(node);
    }
    expectSymbol(node, 'a');
  });

  test(`elif chain with ${BUN_FAIL_LENGTH_ELIF} branches nests through alternate`, () => {
    let node = parseStatement(
      `{% if a %}${'{% elif a %}'.repeat(BUN_FAIL_LENGTH_ELIF)}{% endif %}`
    );
    for (let i = 0; i < BUN_FAIL_LENGTH_ELIF; i++) {
      expect(node.type).toBe('if');
      node = alternateOf(node) as Node;
    }
    expect(node.type).toBe('if');
    expect(alternateOf(node)).toBeNull();
  });
});

describe('deep chains: statement-list loops', () => {
  test(`match with ${N} when branches collects every case`, () => {
    const node = parseStatement(`{% match a %}${'{% when a %}'.repeat(N)}{% endmatch %}`);
    expect(node.type).toBe('match');
    expect((node as { cases: readonly Node[] }).cases.length).toBe(N);
  });

  test(`switch with ${N} cases collects every case`, () => {
    const node = parseStatement(`{% switch a %}${'{% case a %}'.repeat(N)}{% endswitch %}`);
    expect(node.type).toBe('switch');
    expect((node as { cases: readonly Node[] }).cases.length).toBe(N);
  });

  test(`scope with ${N + 1} assignments parses`, () => {
    const node = parseStatement(`{% scope ${'a = 1,'.repeat(N)}a = 1 %}x{% endscope %}`);
    expect(node.type).toBe('scope');
  });

  test(`for target with ${N + 1} names builds one array`, () => {
    const node = parseStatement(`{% for ${'a,'.repeat(N)}a in items %}x{% endfor %}`);
    expect(node.type).toBe('for');
    const name = (node as { name: Node }).name;
    expect(name.type).toBe('array');
    expect(childrenOf(name).length).toBe(N + 1);
  });

  test(`from-import with ${N + 1} names imports every one`, () => {
    const node = parseStatement(`{% from 'x.njk' import ${'a,'.repeat(N)}a %}`);
    expect(node.type).toBe('fromImport');
    const names = (node as { names: Node }).names;
    expect(childrenOf(names).length).toBe(N + 1);
  });

  test(`array pattern with ${N + 1} elements parses as one pattern`, () => {
    const node = parseStatement(`{% for [${'a,'.repeat(N)}a] in items %}x{% endfor %}`);
    const name = (node as { name: Node }).name;
    expect(name.type).toBe('arrayPattern');
    expect(childrenOf(name).length).toBe(N + 1);
  });

  test(`object pattern with ${N + 1} properties parses as one pattern`, () => {
    const node = parseStatement(`{% for {${'a: b,'.repeat(N)}a: b} in items %}x{% endfor %}`);
    const name = (node as { name: Node }).name;
    expect(name.type).toBe('objectPattern');
    expect(childrenOf(name).length).toBe(N + 1);
  });
});

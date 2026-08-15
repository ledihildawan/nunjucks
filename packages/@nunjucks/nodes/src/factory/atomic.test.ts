import { describe, expect, test } from 'bun:test';
import { type Loc, loc, ZERO_LOC } from '@nunjucks/shared';
import type {
  ChildrenNode,
  GenericNode,
  HoleNode,
  LiteralNode,
  Node,
  PairNode,
  RangeNode,
  SpreadNode,
  SymbolNode,
  TemplateDataNode,
  TemplateLiteralNode,
  TemplateQuasi,
  ValueNode,
  WalrusNode,
} from '../types/index.ts';
import { T } from '../types/index.ts';
import {
  array,
  dict,
  group,
  hole,
  keywordArgs,
  literal,
  node,
  nodeList,
  output,
  pair,
  range,
  root,
  spread,
  symbol,
  templateData,
  templateLiteral,
  value,
  walrus,
} from './atomic.ts';

const customLoc: Loc = loc({ lineno: 10, colno: 20 });
const childNode = literal(ZERO_LOC, 99);
const keyNode = symbol(ZERO_LOC, 'k');
const valueOperand = literal(ZERO_LOC, 42);
const lowerBound = literal(ZERO_LOC, 1);
const upperBound = literal(ZERO_LOC, 10);

describe('node', () => {
  test('creates a generic node forwarding lineno and colno', () => {
    const genericNode: GenericNode = node(customLoc);
    expect(genericNode.type).toBe(T.NODE);
    expect(genericNode.lineno).toBe(customLoc.lineno);
    expect(genericNode.colno).toBe(customLoc.colno);
  });
});

describe('value-bearing nodes', () => {
  type ValueBearingNode = ValueNode | LiteralNode | SymbolNode | TemplateDataNode;
  const valueNodeCases: ReadonlyArray<{
    factory: string;
    typename: ValueBearingNode['type'];
    sampleValue: unknown;
    build: (loc: Loc, val: unknown) => ValueBearingNode;
  }> = [
    { factory: 'value', typename: T.VALUE, sampleValue: 42, build: (position, val) => value(position, val) },
    {
      factory: 'literal',
      typename: T.LITERAL,
      sampleValue: 'hello',
      build: (position, val) => literal(position, val),
    },
    {
      factory: 'symbol',
      typename: T.SYMBOL,
      sampleValue: 'x',
      build: (position, val) => symbol(position, val as string),
    },
    {
      factory: 'templateData',
      typename: T.TEMPLATE_DATA,
      sampleValue: 'raw',
      build: (position, val) => templateData(position, val as string),
    },
  ];

  valueNodeCases.forEach(({ factory, typename, sampleValue, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const valueNode = build(customLoc, sampleValue);
        expect(valueNode.type).toBe(typename);
        expect(valueNode.lineno).toBe(customLoc.lineno);
        expect(valueNode.colno).toBe(customLoc.colno);
      });

      test('attaches the provided value', () => {
        const valueNode = build(ZERO_LOC, sampleValue);
        expect(valueNode.value).toBe(sampleValue);
      });
    });
  });
});

describe('hole', () => {
  test('creates a hole node forwarding location', () => {
    const holeNode: HoleNode = hole(customLoc);
    expect(holeNode.type).toBe(T.HOLE);
    expect(holeNode.lineno).toBe(customLoc.lineno);
    expect(holeNode.colno).toBe(customLoc.colno);
  });
});

describe('children-bearing nodes', () => {
  const childrenNodeCases: ReadonlyArray<{
    factory: string;
    typename: ChildrenNode['type'];
    build: (loc: Loc, children?: readonly Node[]) => ChildrenNode;
  }> = [
    {
      factory: 'nodeList',
      typename: T.NODE_LIST,
      build: (position, children) => nodeList(position, children),
    },
    { factory: 'output', typename: T.OUTPUT, build: (position, children) => output(position, children) },
    { factory: 'root', typename: T.ROOT, build: (position, children) => root(position, children) },
    { factory: 'group', typename: T.GROUP, build: (position, children) => group(position, children) },
    { factory: 'array', typename: T.ARRAY, build: (position, children) => array(position, children) },
    { factory: 'dict', typename: T.DICT, build: (position, children) => dict(position, children) },
    {
      factory: 'keywordArgs',
      typename: T.KEYWORD_ARGS,
      build: (position, children) => keywordArgs(position, children),
    },
  ];

  childrenNodeCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const containerNode = build(customLoc, []);
        expect(containerNode.type).toBe(typename);
        expect(containerNode.lineno).toBe(customLoc.lineno);
        expect(containerNode.colno).toBe(customLoc.colno);
      });

      test('attaches the provided children', () => {
        const containerNode = build(ZERO_LOC, [childNode]);
        expect(containerNode.children).toEqual([childNode]);
      });

      test('defaults to an empty children array when omitted', () => {
        const containerNode = build(customLoc);
        expect(containerNode.children).toEqual([]);
      });
    });
  });
});

describe('pair', () => {
  test('creates a pair node storing key and value (val maps to value)', () => {
    const pairNode: PairNode = pair(customLoc, { key: keyNode, val: valueOperand });
    expect(pairNode.type).toBe(T.PAIR);
    expect(pairNode.lineno).toBe(customLoc.lineno);
    expect(pairNode.colno).toBe(customLoc.colno);
    expect(pairNode.key).toBe(keyNode);
    expect(pairNode.value).toBe(valueOperand);
  });

  test('accepts a string key', () => {
    const pairNode = pair(ZERO_LOC, { key: 'identifier', val: valueOperand });
    expect(pairNode.key).toBe('identifier');
    expect(pairNode.value).toBe(valueOperand);
  });
});

describe('spread', () => {
  test('creates a spread node forwarding the argument', () => {
    const spreadNode: SpreadNode = spread(customLoc, { argument: keyNode });
    expect(spreadNode.type).toBe(T.SPREAD);
    expect(spreadNode.lineno).toBe(customLoc.lineno);
    expect(spreadNode.colno).toBe(customLoc.colno);
    expect(spreadNode.argument).toBe(keyNode);
  });
});

describe('walrus', () => {
  test('creates a walrus node storing target and value (val maps to value)', () => {
    const walrusNode: WalrusNode = walrus(customLoc, { target: keyNode, val: valueOperand });
    expect(walrusNode.type).toBe(T.WALRUS);
    expect(walrusNode.lineno).toBe(customLoc.lineno);
    expect(walrusNode.colno).toBe(customLoc.colno);
    expect(walrusNode.target).toBe(keyNode);
    expect(walrusNode.value).toBe(valueOperand);
  });
});

describe('templateLiteral', () => {
  test('creates a templateLiteral node defaulting quasis to empty', () => {
    const templateLiteralNode: TemplateLiteralNode = templateLiteral(customLoc);
    expect(templateLiteralNode.type).toBe(T.TEMPLATE_LITERAL);
    expect(templateLiteralNode.lineno).toBe(customLoc.lineno);
    expect(templateLiteralNode.colno).toBe(customLoc.colno);
    expect(templateLiteralNode.quasis).toEqual([]);
  });

  test('attaches mixed template and expression quasis', () => {
    const quasis: readonly TemplateQuasi[] = [
      { type: 'template', value: 'hello ' },
      { type: 'expression', node: keyNode },
    ];
    const templateLiteralNode = templateLiteral(ZERO_LOC, [...quasis]);
    expect(templateLiteralNode.quasis).toEqual(quasis);
  });
});

describe('range', () => {
  test('creates a range node attaching left and right bounds', () => {
    const rangeNode: RangeNode = range(customLoc, { left: lowerBound, right: upperBound });
    expect(rangeNode.type).toBe(T.RANGE);
    expect(rangeNode.lineno).toBe(customLoc.lineno);
    expect(rangeNode.colno).toBe(customLoc.colno);
    expect(rangeNode.left).toBe(lowerBound);
    expect(rangeNode.right).toBe(upperBound);
  });
});

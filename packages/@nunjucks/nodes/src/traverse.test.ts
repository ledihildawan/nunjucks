import { describe, expect, test } from 'bun:test';
import { ZERO_LOC } from '@nunjucks/shared';
import type { ChildrenNode, Node, TemplateQuasi } from './index.ts';
import {
  block,
  component,
  include,
  literal,
  nodeList,
  output,
  renderNode,
  root,
  symbol,
  templateData,
  templateLiteral,
} from './index.ts';
import { appendChild, findAll, walk } from './traverse.ts';

describe('walk', () => {
  test('visits all nodes in AST', () => {
    const ast = root(ZERO_LOC, [
      output(ZERO_LOC, [templateData(ZERO_LOC, 'a')]),
      output(ZERO_LOC, [templateData(ZERO_LOC, 'b')]),
    ]) as Node;
    const visited: string[] = [];
    walk(ast, (n: Node) => {
      visited.push(n.type);
      return undefined;
    });
    expect(visited).toContain('root');
    expect(visited).toContain('output');
    expect(visited).toContain('templateData');
  });

  test('replaces node when fn returns new node', () => {
    const ast = root(ZERO_LOC, [output(ZERO_LOC, [templateData(ZERO_LOC, 'a')])]) as Node;
    const transformed = walk(ast, (n: Node) => {
      if (n.type === 'templateData') {
        return { ...n, value: 'REPLACED' } as Node;
      }
      return undefined;
    }) as Node & { children: Node[] };
    expect(transformed).not.toBe(ast);
  });

  test('returns same reference when no changes', () => {
    const ast = root(ZERO_LOC, [output(ZERO_LOC, [])]) as Node;
    const result = walk(ast, () => undefined);
    expect(result).toBe(ast);
  });
});

describe('findAll', () => {
  test('finds nodes by type string', () => {
    const ast = root(ZERO_LOC, [
      output(ZERO_LOC, [templateData(ZERO_LOC, 'a')]),
      output(ZERO_LOC, [templateData(ZERO_LOC, 'b')]),
    ]) as Node;
    const results = findAll(ast, 'output');
    expect(results.length).toBe(2);
  });

  test('finds nodes by predicate', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, { name: 'x', body: output(ZERO_LOC, []) }),
      block(ZERO_LOC, { name: 'y', body: output(ZERO_LOC, []) }),
    ]) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'block');
    expect(results.length).toBe(2);
  });

  test('returns empty for non-existent type', () => {
    const ast = root(ZERO_LOC, []) as Node;
    const results = findAll(ast, 'nonexistent');
    expect(results).toEqual([]);
  });

  test('descends into template literal quasi envelopes', () => {
    const ast = output(ZERO_LOC, [
      templateLiteral(ZERO_LOC, [
        { type: 'template', value: 'prefix' },
        { type: 'expression', node: symbol(ZERO_LOC, 'dangerous') },
      ]),
    ]) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'symbol');
    expect(results).toHaveLength(1);
    expect((results[0] as { value?: unknown }).value).toBe('dangerous');
  });

  test('descends into component fallback slot bodies', () => {
    const ast = component(ZERO_LOC, {
      name: 'card',
      body: output(ZERO_LOC, []),
      fallbackSlots: [{ name: 'fallback', params: [], body: nodeList(ZERO_LOC, [symbol(ZERO_LOC, 'slotBody')]) }],
    }) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'symbol');
    expect(results).toHaveLength(1);
    expect((results[0] as { value?: unknown }).value).toBe('slotBody');
  });

  test('descends into render provided slot bodies', () => {
    const ast = renderNode(ZERO_LOC, {
      callExpr: symbol(ZERO_LOC, 'partial'),
      body: output(ZERO_LOC, []),
      providedSlots: [{ name: 'header', params: [], body: nodeList(ZERO_LOC, [symbol(ZERO_LOC, 'headerBody')]) }],
    }) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'symbol');
    expect(results.map((n) => (n as { value?: unknown }).value)).toContain('headerBody');
  });

  test('descends into include with expressions', () => {
    const ast = include(ZERO_LOC, {
      template: literal(ZERO_LOC, 'partial.njk'),
      with: symbol(ZERO_LOC, 'extraContext'),
    }) as Node;
    const results = findAll(ast, (n: Node) => n.type === 'symbol');
    expect(results).toHaveLength(1);
    expect((results[0] as { value?: unknown }).value).toBe('extraContext');
  });
});

describe('walk with envelopes', () => {
  test('replaces nodes wrapped in template literal quasi envelopes', () => {
    const ast = output(ZERO_LOC, [
      templateLiteral(ZERO_LOC, [
        { type: 'template', value: 'prefix' },
        { type: 'expression', node: symbol(ZERO_LOC, 'dangerous') },
      ]),
    ]) as Node;
    const transformed = walk(ast, (n: Node) =>
      n.type === 'symbol' ? literal(ZERO_LOC, 'safe') : undefined
    ) as Node;
    const quasis = (
      (transformed as { children: readonly Node[] }).children[0] as {
        quasis: readonly TemplateQuasi[];
      }
    ).quasis;
    const expressionQuasi = quasis.find((q) => q.type === 'expression');
    expect(expressionQuasi && expressionQuasi.type === 'expression' && 'node' in expressionQuasi
      ? expressionQuasi.node.type
      : undefined).toBe('literal');
  });

  test('replaces nodes inside component fallback slot bodies', () => {
    const ast = component(ZERO_LOC, {
      name: 'card',
      body: output(ZERO_LOC, []),
      fallbackSlots: [
        { name: 'fallback', params: [], body: nodeList(ZERO_LOC, [symbol(ZERO_LOC, 'slotBody')]) },
      ],
    }) as Node;
    const transformed = walk(ast, (n: Node) =>
      n.type === 'symbol' ? literal(ZERO_LOC, 'replaced') : undefined
    ) as Node;
    const slots = (transformed as { fallbackSlots: readonly { body: Node }[] }).fallbackSlots;
    const slotBodyChild = slots[0]?.body as { children: readonly Node[] };
    expect(slotBodyChild.children[0]?.type).toBe('literal');
  });
});

describe('appendChild', () => {
  test('appends child to node with children array', () => {
    const node = output(ZERO_LOC, []) as ChildrenNode;
    const child = templateData(ZERO_LOC, 'x');
    const result = appendChild(node, child);
    expect(result.children.length).toBe(1);
    expect(result.children[0]).toBe(child);
  });

  test('does not mutate original node', () => {
    const node = output(ZERO_LOC, []) as ChildrenNode;
    const originalLen = node.children.length;
    appendChild(node, templateData(ZERO_LOC, 'x'));
    expect(node.children.length).toBe(originalLen);
  });
});

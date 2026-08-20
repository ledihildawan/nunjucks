import { describe, expect, test } from 'bun:test';
import type { Node } from '@nunjucks/nodes';
import {
  block,
  findAll,
  funCall,
  nodeList,
  output,
  root,
  symbol,
  templateData,
} from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import { transform } from './index.ts';

describe('transform (liftSuper)', () => {
  test('does not modify AST without super() calls', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'content',
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'hello')]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
    expect(findAll(transformed, 'super')).toHaveLength(0);
  });

  test('transforms super() call in block', () => {
    const superCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'content',
        body: output(ZERO_LOC, [superCall]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
    const lifted = findAll(transformed, 'super');
    expect(lifted.length).toBeGreaterThanOrEqual(1);
    expect((lifted[0] as { blockName?: string }).blockName).toBe('content');
  });

  test('binds super() in a nested block to the inner block, not the outer one', () => {
    const innerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'outer',
        body: nodeList(ZERO_LOC, [
          block(ZERO_LOC, {
            name: 'inner',
            body: output(ZERO_LOC, [innerSuperCall]),
          }),
        ]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    const lifted = findAll(transformed, 'super');
    expect(lifted).toHaveLength(1);
    expect((lifted[0] as { blockName?: string }).blockName).toBe('inner');
  });

  test('leaves a nested block super() untouched when only the outer block is scanned', () => {
    const innerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'outer',
        body: output(ZERO_LOC, [
          templateData(ZERO_LOC, 'outer body'),
          block(ZERO_LOC, {
            name: 'inner',
            body: output(ZERO_LOC, [innerSuperCall]),
          }),
        ]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    const lifted = findAll(transformed, 'super');
    expect(lifted).toHaveLength(1);
    expect((lifted[0] as { blockName?: string }).blockName).toBe('inner');
    const outerBlock = findAll(transformed, 'block').find(
      (n) => (n as { name?: unknown }).name === 'outer'
    ) as { body: { children: readonly Node[] } };
    expect(outerBlock.body.children.some((child) => child.type === 'super')).toBe(false);
  });

  test('preserves block structure after transform', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, { name: 'header', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'H')]) }),
      block(ZERO_LOC, { name: 'footer', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'F')]) }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast) as Node & { children: Node[] };
    expect(transformed.children.length).toBeGreaterThanOrEqual(2);
  });

  test('lifts super() in a nested inner block even when the outer block also calls super()', () => {
    // WHY: regression — walk short-circuits a replaced subtree, so the outer block's
    // rewrite used to hide the inner block from the visitor and its super() failed at
    // render time; the walk must resume inside the replacement.
    const outerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const innerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'outer',
        body: nodeList(ZERO_LOC, [
          templateData(ZERO_LOC, 'outer body'),
          outerSuperCall,
          block(ZERO_LOC, {
            name: 'inner',
            body: nodeList(ZERO_LOC, [templateData(ZERO_LOC, 'inner body'), innerSuperCall]),
          }),
        ]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    const lifted = findAll(transformed, 'super');
    expect(lifted).toHaveLength(2);
    const blockNames = lifted.map((n) => (n as { blockName?: string }).blockName).sort();
    expect(blockNames).toEqual(['inner', 'outer']);
  });

  test('lifts super() at every level of 3-deep nested blocks', () => {
    const superCall = () => funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'outer',
        body: nodeList(ZERO_LOC, [
          templateData(ZERO_LOC, 'o:'),
          superCall(),
          block(ZERO_LOC, {
            name: 'middle',
            body: nodeList(ZERO_LOC, [
              templateData(ZERO_LOC, 'm:'),
              superCall(),
              block(ZERO_LOC, {
                name: 'inner',
                body: nodeList(ZERO_LOC, [templateData(ZERO_LOC, 'i:'), superCall()]),
              }),
            ]),
          }),
        ]),
      }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    const lifted = findAll(transformed, 'super');
    expect(lifted).toHaveLength(3);
    const blockNames = lifted.map((n) => (n as { blockName?: string }).blockName).sort();
    expect(blockNames).toEqual(['inner', 'middle', 'outer']);
  });

  test('is idempotent — a second pass lifts nothing and finds no super funCalls', () => {
    const outerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const innerSuperCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'outer',
        body: nodeList(ZERO_LOC, [
          outerSuperCall,
          block(ZERO_LOC, {
            name: 'inner',
            body: nodeList(ZERO_LOC, [innerSuperCall]),
          }),
        ]),
      }),
    ]) as Node & { children: Node[] };
    const once = transform(ast);
    const twice = transform(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(findAll(twice, 'super')).toHaveLength(2);
  });

  test('does not mutate the input AST (copy-on-write contract)', () => {
    const superCall = funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'super'), args: [] });
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, {
        name: 'content',
        body: output(ZERO_LOC, [superCall]),
      }),
    ]) as Node & { children: Node[] };
    const snapshot = JSON.stringify(ast);

    const transformed = transform(ast);

    expect(JSON.stringify(ast)).toBe(snapshot);
    expect(transformed).not.toBe(ast);
    expect(findAll(transformed, 'super').length).toBeGreaterThanOrEqual(1);
  });
});

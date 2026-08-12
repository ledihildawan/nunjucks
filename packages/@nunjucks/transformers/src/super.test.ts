import { describe, test, expect } from 'bun:test';
import { transform } from './index.ts';
import { root, block, output, templateData, symbol, funCall, findAll } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/lexer';

describe('transform (liftSuper)', () => {
  test('does not modify AST without super() calls', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, { name: 'content', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'hello')]) }),
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

  test('preserves block structure after transform', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, { name: 'header', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'H')]) }),
      block(ZERO_LOC, { name: 'footer', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'F')]) }),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast) as Node & { children: Node[] };
    expect(transformed.children.length).toBeGreaterThanOrEqual(2);
  });
});

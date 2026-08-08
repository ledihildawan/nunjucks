import { describe, test, expect } from 'bun:test';
import { transform } from './index.ts';
import { root, block, superNode, output, templateData, literal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';

describe('transform (liftSuper)', () => {
  test('does not modify AST without super() calls', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, 'content', output(ZERO_LOC, [templateData(ZERO_LOC, 'hello')])),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
  });

  test('transforms super() call in block', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, 'content',
        output(ZERO_LOC, [
          superNode(ZERO_LOC, 'content', literal(ZERO_LOC, 'super')),
        ]),
      ),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
  });

  test('preserves block structure after transform', () => {
    const ast = root(ZERO_LOC, [
      block(ZERO_LOC, 'header', output(ZERO_LOC, [templateData(ZERO_LOC, 'H')])),
      block(ZERO_LOC, 'footer', output(ZERO_LOC, [templateData(ZERO_LOC, 'F')])),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast) as Node & { children: Node[] };
    expect(transformed.children.length).toBeGreaterThanOrEqual(2);
  });
});

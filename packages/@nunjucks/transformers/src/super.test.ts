import { describe, test, expect } from 'bun:test';
import { transform } from './index.ts';
import { root, block, superNode, output, templateData, literal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';

describe('transform (liftSuper)', () => {
  test('does not modify AST without super() calls', () => {
    const ast = root(0, 0, [
      block(0, 0, 'content', output(0, 0, [templateData(0, 0, 'hello')])),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
  });

  test('transforms super() call in block', () => {
    const ast = root(0, 0, [
      block(0, 0, 'content',
        output(0, 0, [
          superNode(0, 0, 'content', literal(0, 0, 'super')),
        ]),
      ),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast);
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('root');
  });

  test('preserves block structure after transform', () => {
    const ast = root(0, 0, [
      block(0, 0, 'header', output(0, 0, [templateData(0, 0, 'H')])),
      block(0, 0, 'footer', output(0, 0, [templateData(0, 0, 'F')])),
    ]) as Node & { children: Node[] };
    const transformed = transform(ast) as Node & { children: Node[] };
    expect(transformed.children.length).toBeGreaterThanOrEqual(2);
  });
});

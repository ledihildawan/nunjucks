import { describe, test, expect } from 'bun:test';
import { parse } from '../index.ts';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('parse - switch statement', () => {
  test('parses switch with case', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% endswitch %}');
    expect(getNodeTypeName(ast.children[0])).toBe('switch');
  });

  test('parses switch with default', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% default %}other{% endswitch %}');
    expect(getNodeTypeName(ast.children[0])).toBe('switch');
  });

  test('parses switch with multiple cases', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% case 2 %}two{% case 3 %}three{% endswitch %}');
    expect(getNodeTypeName(ast.children[0])).toBe('switch');
  });
});

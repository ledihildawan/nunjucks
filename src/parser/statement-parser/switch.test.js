import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - switch statement', () => {
  test('parses switch with case', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% endswitch %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('switch');
  });

  test('parses switch with default', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% default %}other{% endswitch %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('switch');
  });

  test('parses switch with multiple cases', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% case 2 %}two{% case 3 %}three{% endswitch %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('switch');
  });
});


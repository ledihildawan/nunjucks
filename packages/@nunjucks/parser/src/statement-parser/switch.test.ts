import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node, SwitchNode } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseSwitch', () => {
  test('parses a switch with a single case', () => {
    const node = parseFirst('{% switch x %}{% case 1 %}one{% endswitch %}') as SwitchNode;
    expect(getNodeTypeName(node)).toBe('switch');
    expect(node.cases).toHaveLength(1);
    expect(getNodeTypeName(node.cases[0])).toBe('case');
  });

  test('parses multiple cases', () => {
    const node = parseFirst(
      '{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}'
    ) as SwitchNode;
    expect(getNodeTypeName(node)).toBe('switch');
    expect(node.cases).toHaveLength(2);
  });

  test('parses a default case', () => {
    const node = parseFirst('{% switch x %}{% default %}fallback{% endswitch %}') as SwitchNode;
    expect(getNodeTypeName(node)).toBe('switch');
    expect(node.default).not.toBeNull();
  });

  test('captures the switch expression', () => {
    const node = parseFirst('{% switch x.y %}{% case 1 %}one{% endswitch %}') as SwitchNode;
    expect(getNodeTypeName(node)).toBe('switch');
    expect(getNodeTypeName(node.expr)).toBe('lookupVal');
  });
});

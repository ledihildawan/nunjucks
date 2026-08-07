import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName, isSwitch } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return parseNodes(ctx)[0] as Node;
};

describe('parseSwitch', () => {
  test('parses a switch with a single case', () => {
    const node = parseFirst('{% switch x %}{% case 1 %}one{% endswitch %}');
    expect(getNodeTypeName(node)).toBe('switch');
    expect(isSwitch(node)).toBe(true);
    if (!isSwitch(node)) { return; }
    expect(node.cases).toHaveLength(1);
    expect(getNodeTypeName(node.cases[0])).toBe('case');
  });

  test('parses multiple cases', () => {
    const node = parseFirst(
      '{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}'
    );
    expect(isSwitch(node)).toBe(true);
    if (!isSwitch(node)) { return; }
    expect(node.cases).toHaveLength(2);
  });

  test('parses a default case', () => {
    const node = parseFirst(
      '{% switch x %}{% default %}fallback{% endswitch %}'
    );
    expect(isSwitch(node)).toBe(true);
    if (!isSwitch(node)) { return; }
    expect(node.default).not.toBeNull();
  });

  test('captures the switch expression', () => {
    const node = parseFirst('{% switch x.y %}{% case 1 %}one{% endswitch %}');
    expect(isSwitch(node)).toBe(true);
    if (!isSwitch(node)) { return; }
    expect(getNodeTypeName(node.expr)).toBe('lookupVal');
  });
});
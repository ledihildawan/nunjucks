import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseComponent', () => {
  test('parses a component with a name and no args', () => {
    const node = parseFirst('{% component card %}body{% endcomponent %}');
    expect(getNodeTypeName(node)).toBe('component');
    expect((node as { name: string }).name).toBe('card');
  });

  test('parses component args', () => {
    const node = parseFirst('{% component card("a", 1) %}body{% endcomponent %}');
    const args = (node as { args: readonly Node[] }).args;
    expect(args).toHaveLength(2);
  });

  test('stashes plain body content in the body node', () => {
    const node = parseFirst('{% component card %}body text{% endcomponent %}');
    expect(getNodeTypeName((node as { body: Node }).body)).toBe('nodeList');
  });

  test('collects unnamed slot blocks as an explicit default fallback slot', () => {
    const node = parseFirst(
      '{% component card %}{% slot default %}fallback{% endslot %}{% endcomponent %}'
    );
    const slots = (node as { fallbackSlots: readonly SlotBlock[] }).fallbackSlots;
    expect(slots).toHaveLength(1);
    expect(slots[0]?.name).toBe('default');
  });

  test('collects named slots', () => {
    const node = parseFirst(
      '{% component card %}{% slot header %}head{% endslot %}body{% endcomponent %}'
    );
    const slots = (node as { fallbackSlots: readonly SlotBlock[] }).fallbackSlots;
    expect(slots.some((s) => s.name === 'header')).toBe(true);
  });
});

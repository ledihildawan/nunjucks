import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { parseUntilBlocks, parseNodes } from './parse-root.ts';
import { createParser } from './index.ts';
import { peekTokenOrNull } from './cursor.ts';
import type { TokenStream } from './cursor.ts';
import { getNodeTypeName, isNodeList, isOutput, isTemplateData } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';

const makeCtx = (src: string) => {
  const tk = createTokenizer(src);
  return createParser(tk as unknown as TokenStream);
};

const parse = (src: string, ...blocks: string[]) => parseUntilBlocks(makeCtx(src), ...blocks);

const childrenOf = (n: Node): readonly Node[] =>
  isNodeList(n) ? n.children : isOutput(n) ? n.children : [];

describe('parseUntilBlocks', () => {
  describe('block boundaries', () => {
    test('parses content until the single named block tag', () => {
      const node = parse('hello{% endblock %}', 'endblock');
      expect(getNodeTypeName(node)).toBe('nodeList');
      expect(isNodeList(node)).toBe(true);
      expect(childrenOf(node)).toHaveLength(1);
    });

    test('stops at any of the multiple named blocks', () => {
      expect(childrenOf(parse('a{% endblock %}', 'endblock', 'endif'))).toHaveLength(1);
      expect(childrenOf(parse('a{% endif %}', 'endblock', 'endif'))).toHaveLength(1);
    });

    test('leaves the breakOn tag unconsumed in the token stream', () => {
      const ctx = makeCtx('a{% endblock %}');
      parseUntilBlocks(ctx, 'endblock');
      expect(peekTokenOrNull(ctx)).not.toBeNull();
    });

    test('empty body returns an empty NodeList', () => {
      const node = parse('{% endblock %}', 'endblock');
      expect(getNodeTypeName(node)).toBe('nodeList');
      expect(isNodeList(node)).toBe(true);
      expect(childrenOf(node)).toHaveLength(0);
    });
  });

  describe('node collection', () => {
    test('text data tokens are collected into output nodes wrapping templateData', () => {
      const node = parse('abc{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(1);

      const out = children[0] as Node;
      expect(isOutput(out)).toBe(true);

      const outChildren = childrenOf(out);
      expect(outChildren).toHaveLength(1);
      expect(getNodeTypeName(outChildren[0])).toBe('templateData');
      const td = outChildren[0];
      expect(isTemplateData(td) ? td.value : undefined).toBe('abc');
    });

    test('multiple data tokens stay in source order', () => {
      const node = parse('a{{ x }}b{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(3);
      const first = childrenOf(children[0] as Node)[0];
      const last = childrenOf(children[2] as Node)[0];
      expect(isTemplateData(first) ? first.value : undefined).toBe('a');
      expect(isTemplateData(last) ? last.value : undefined).toBe('b');
    });

    test('variable expressions within the region are included', () => {
      const node = parse('hi {{ x }}{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(2);

      const exprOut = children[1] as Node;
      expect(isOutput(exprOut)).toBe(true);
      const expr = childrenOf(exprOut)[0];
      expect(getNodeTypeName(expr)).toBe('symbol');
      expect(expr?.value).toBe('x');
    });

    test('nested block statements within the region are parsed', () => {
      const node = parse('{% if true %}yes{% endif %}{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(1);
      expect(getNodeTypeName(children[0])).toBe('if');
    });

    test('a for-loop nested in the region is parsed as a single child', () => {
      const node = parse('{% for i in [1,2] %}{{ i }}{% endfor %}{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(1);
      expect(getNodeTypeName(children[0])).toBe('for');
    });
  });

  describe('whitespace control', () => {
    test('{%- strips trailing whitespace of the preceding data token', () => {
      const node = parse('x   {%- endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(1);
      const td = childrenOf(children[0] as Node)[0];
      expect(isTemplateData(td) ? td.value : undefined).toBe('x');
    });

    test('-}} strips leading whitespace of the following data token', () => {
      const node = parse('{{ x -}}   y{% endblock %}', 'endblock');
      const children = childrenOf(node);
      expect(children).toHaveLength(2);
      const td = childrenOf(children[1] as Node)[0];
      expect(isTemplateData(td) ? td.value : undefined).toBe('y');
    });

    test('whitespace is preserved when no control marker is present', () => {
      const node = parse('x   {{ y }}   z{% endblock %}', 'endblock');
      const children = childrenOf(node);
      const head = childrenOf(children[0] as Node)[0];
      const tail = childrenOf(children[2] as Node)[0];
      expect(isTemplateData(head) ? head.value : undefined).toBe('x   ');
      expect(isTemplateData(tail) ? tail.value : undefined).toBe('   z');
    });
  });
});

describe('parseNodes', () => {
  test('parses all tokens until EOF when breakOn is null', () => {
    const ctx = makeCtx('hello {{ x }}');
    const nodes = parseNodes(ctx);
    expect(nodes).toHaveLength(2);
    expect(getNodeTypeName(nodes[0])).toBe('output');
    expect(getNodeTypeName(nodes[1])).toBe('output');
  });

  test('stops at the breakOn block name without consuming it', () => {
    const ctx = makeCtx('a{% endblock %}b');
    const nodes = parseNodes(ctx, ['endblock']);
    expect(nodes).toHaveLength(1);
    expect(peekTokenOrNull(ctx)).not.toBeNull();
  });

  test('accepts a readonly breakOn list', () => {
    const ctx = makeCtx('a{% endif %}');
    const breakOn: readonly string[] = ['endif'];
    expect(parseNodes(ctx, breakOn)).toHaveLength(1);
  });

  test('returns an empty array for empty input', () => {
    const ctx = makeCtx('');
    expect(parseNodes(ctx)).toEqual([]);
  });

  test('returns an empty array when the first token is a breakOn tag', () => {
    const ctx = makeCtx('{% endblock %}trailing');
    expect(parseNodes(ctx, ['endblock'])).toEqual([]);
  });
});

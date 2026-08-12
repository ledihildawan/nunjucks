import { describe, test, expect } from 'bun:test';
import { nunjucks } from './index.ts';
import type { nodes } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/lexer';
import { skipSymbol, advanceAfterBlockEnd, type ParserContext } from '@nunjucks/parser';

// WHY: a minimal custom block-tag extension. `tags` lets the parser dispatch `{% hello %}` to this extension's
// parse callback; `extensionName` is the runtime lookup key (env.getExtension("hello")); `run` is the method
// the compiled code invokes. The parse callback consumes the tag tokens and emits a callExtension node.
const helloExtension = {
  extensionName: 'hello',
  tags: ['hello'],
  autoescape: true,
  parse: (parserContext: ParserContext, namespace: typeof nodes) => {
    skipSymbol(parserContext, 'hello');
    advanceAfterBlockEnd(parserContext);
    return namespace.callExtension(ZERO_LOC, {
      ext: helloExtension,
      prop: 'run',
      args: namespace.nodeList(ZERO_LOC),
      contentArgs: [],
    });
  },
  run: () => 'Hello from extension!',
};

describe('extension wiring (end-to-end)', () => {
  test('a custom block tag registered via factory config renders its output', async () => {
    const njk = nunjucks({ extensions: { hello: helloExtension } });
    const result = await njk.render('prefix {% hello %} suffix');
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('prefix Hello from extension! suffix');
  });

  test('a custom tag registered via a plugin renders its output', async () => {
    const njk = nunjucks({ plugins: [{ name: 'hello-plugin', extensions: { hello: helloExtension } }] });
    const result = await njk.render('{% hello %}');
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('Hello from extension!');
  });

  test('an unregistered custom tag is rejected by the parser as an unknown block tag', async () => {
    const njk = nunjucks({});
    const result = await njk.render('{% nope %}');
    expect(result.ok).toBe(false);
  });
});

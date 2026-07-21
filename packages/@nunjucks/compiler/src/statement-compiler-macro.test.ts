import { describe, test, expect } from 'bun:test';
import { compileMacroPublic } from '@nunjucks/compiler/statement-compiler/macro';
import { symbol, getNodeTypeName } from '@nunjucks/nodes';

const makeCtx = () => {
  const emitted: string[] = [];
  let lastId = 0;
  const bufStack: (string | null)[] = [];
  let buf = 'output';
  return {
    emitted,
    _emit: (s: string) => emitted.push(s),
    _emitLine: (s: string) => emitted.push(s + '\n'),
    _emitLines: (...lines: string[]) => lines.forEach((l) => emitted.push(l + '\n')),
    _tmpid: () => {
      lastId++;
      return 't_' + lastId;
    },
    _compileExpression: (node: { mock?: string }) => emitted.push(node.mock as string),
    compile: (node: { mock?: string }) => emitted.push(node.mock as string),
    _withScopedSyntax: (func: () => void) => func(),
    _pushBuffer: () => {
      bufStack.push(buf);
      buf = 't_' + ++lastId;
      emitted.push('let ' + buf + ' = ""\n');
      return buf;
    },
    _popBuffer: () => {
      buf = bufStack.pop() ?? 'output';
    },
    get buffer(): string {
      return buf;
    },
    set buffer(v: string) {
      buf = v;
    },
    assertType: (node: unknown, ...types: string[]) => {
      if (!types.some((t) => getNodeTypeName(node) === t)) {
        throw new Error(`assertType: invalid type: ${getNodeTypeName(node) as string}`);
      }
    },
  };
};

describe('compileMacroPublic', () => {
  test('asserts arg types', () => {
    const ctx = makeCtx();
    const node = {
      name: symbol(1, 1, 'bad'),
      args: { children: ['not a symbol'] },
      body: { mock: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() => compileMacroPublic(ctx as never, node as never, frame as never)).toThrow('assertType');
  });
});

import { describe, test, expect } from 'bun:test';
import { compileComponentPublic } from '@nunjucks/compiler/statement-compiler/component';
import { symbol, getNodeTypeName } from '@nunjucks/nodes';

const makeCtx = () => {
  const emitted: string[] = [];
  let lastId = 0;
  const bufStack: (string | null)[] = [];
  let buf = 'output';
  return {
    emitted,
    emit: (s: string) => emitted.push(s),
    emitLine: (s: string) => emitted.push(`${s}\n`),
    emitLines: (...lines: string[]) => { for (const l of lines) { emitted.push(`${l}\n`); } },
    tmpid: () => {
      lastId += 1;
      return `t_${lastId}`;
    },
    compileExpression: (node: { mock?: string }) => emitted.push(node.mock as string),
    compile: (node: { mock?: string }) => emitted.push(node.mock as string),
    withScopedSyntax: (func: () => void) => func(),
    pushBuffer: () => {
      bufStack.push(buf);
      lastId += 1;
      buf = `t_${lastId}`;
      emitted.push(`let ${buf} = ""\n`);
      return buf;
    },
    popBuffer: () => {
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

describe('compileComponentPublic', () => {
  test('asserts arg types', () => {
    const ctx = makeCtx();
    const node = {
      name: symbol(1, 1, 'bad'),
      args: ['not a symbol'],
      body: { mock: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() => compileComponentPublic(ctx as never, node as never, frame as never)).toThrow('assertType');
  });
});

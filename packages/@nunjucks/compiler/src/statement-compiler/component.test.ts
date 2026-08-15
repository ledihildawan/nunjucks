import { describe, expect, test } from 'bun:test';
import { compileComponentPublic } from '@nunjucks/compiler/statement-compiler/component';
import { getNodeTypeName, symbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';

const makeCtx = () => {
  const emitted: string[] = [];
  let lastId = 0;
  const bufStack: (string | null)[] = [];
  let buf = 'output';
  return {
    emitted,
    emit: (s: string) => emitted.push(s),
    emitLine: (s: string) => emitted.push(`${s}\n`),
    emitLines: (...lines: string[]) => {
      for (const l of lines) {
        emitted.push(`${l}\n`);
      }
    },
    nextCompilerId: () => {
      lastId += 1;
      return `t_${lastId}`;
    },
    compileExpression: (node: { marker?: string }) => emitted.push(node.marker as string),
    compile: (node: { marker?: string }) => emitted.push(node.marker as string),
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
      name: symbol(loc({ lineno: 1, colno: 1 }), 'bad'),
      args: ['not a symbol'],
      body: { marker: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() =>
      compileComponentPublic(ctx as never, { node: node as never, frame: frame as never })
    ).toThrow('assertType');
  });

  test('rejects non-identifier arg names at the codegen boundary', () => {
    const ctx = makeCtx();
    const node = {
      name: symbol(loc({ lineno: 1, colno: 1 }), 'bad'),
      args: [symbol(loc({ lineno: 1, colno: 1 }), 'a";evil()')],
      body: { marker: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() =>
      compileComponentPublic(ctx as never, { node: node as never, frame: frame as never })
    ).toThrow("Invalid identifier 'a\";evil()'");
  });
});

import { describe, expect, test } from 'bun:test';
import { dict, getNodeTypeName, literal, pair, symbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { compileComponentPublic } from './component.ts';

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
    fail: (options: { message: string }) => {
      throw new Error(options.message);
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

  test('fails loudly when a kwarg key is not a string name', () => {
    // WHY: regression — pairKey used to return '' for non-string keys, leaking
    // an empty kwarg name into kwargNames; it must surface as a compile error.
    const ctx = makeCtx();
    const kwargs = dict(loc({ lineno: 1, colno: 1 }), [
      pair(loc({ lineno: 1, colno: 1 }), {
        key: literal(loc({ lineno: 1, colno: 1 }), 5),
        val: literal(loc({ lineno: 1, colno: 1 }), 1),
      }),
    ]);
    const node = {
      name: symbol(loc({ lineno: 1, colno: 1 }), 'MyComponent'),
      args: [kwargs],
      body: { marker: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() =>
      compileComponentPublic(ctx as never, { node: node as never, frame: frame as never })
    ).toThrow('keyword arguments must be name=value pairs with string names');
  });
});

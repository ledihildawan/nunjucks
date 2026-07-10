import { describe, test, expect } from 'bun:test';
import {
  compileLiteral,
  compileSymbol,
  compileGroup,
  compileArray,
  compileDict,
  compileNodeList,
  compilePair,
  compileKeywordArgs,
} from './container.js';
import { Literal, AstSymbol } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  const compile = (node) => {
    if (node?.typename === 'Literal' || node instanceof Literal) {
      emitted.push(`LIT(${node.value})`);
    } else if (node?.typename === 'Symbol' || node instanceof AstSymbol) {
      emitted.push(`SYM(${node.value})`);
    } else if (typeof node === 'string') {
      emitted.push(node);
    } else if (node.mock) {
      emitted.push(node.mock);
    } else if (node.children) {
      node.children.forEach((c) => compile(c));
    } else {
      emitted.push(`?${node.typename || typeof node}`);
    }
  };
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    compile,
    _compileChildren: (node) => (node.children || []).forEach((c) => compile(c)),
    _compileExpression: (node) => compile(node),
  };
};

const mockFrame = { lookup: () => null };

describe('compileLiteral', () => {
  test('string literals are escaped and quoted', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'hello\nworld' });
    expect(ctx.emitted).toEqual(['"hello\\nworld"']);
  });

  test('null emits null', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: null });
    expect(ctx.emitted).toEqual(['null']);
  });

  test('number emits toString', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 42 });
    expect(ctx.emitted).toEqual(['42']);
  });

  test('boolean emits toString', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: true });
    expect(ctx.emitted).toEqual(['true']);
  });

  test('escapes backslash', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'a\\b' });
    expect(ctx.emitted).toEqual(['"a\\\\b"']);
  });

  test('escapes double quotes', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'say "hi"' });
    expect(ctx.emitted).toEqual(['"say \\"hi\\""']);
  });

  test('escapes carriage return', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'a\rb' });
    expect(ctx.emitted).toEqual(['"a\\rb"']);
  });

  test('escapes tab', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'a\tb' });
    expect(ctx.emitted).toEqual(['"a\\tb"']);
  });

  test('escapes unicode line separator', () => {
    const ctx = makeCtx();
    compileLiteral(ctx, { value: 'a\u2028b' });
    expect(ctx.emitted).toEqual(['"a\\u2028b"']);
  });
});

describe('compileSymbol', () => {
  test('uses frame lookup when found', () => {
    const ctx = makeCtx();
    const frame = { lookup: () => 't_1' };
    compileSymbol(ctx, { value: 'x' }, frame);
    expect(ctx.emitted).toEqual(['t_1']);
  });

  test('uses contextOrFrameLookup when not in frame', () => {
    const ctx = makeCtx();
    compileSymbol(ctx, { value: 'x' }, mockFrame);
    expect(ctx.emitted).toEqual(['runtime.contextOrFrameLookup(context, frame, "x")']);
  });
});

describe('compileGroup', () => {
  test('wraps children in parentheses', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ mock: 'a' }, { mock: 'b' }],
    };
    compileGroup(ctx, node);
    expect(ctx.emitted).toEqual(['(', 'a', ',', 'b', ')']);
  });
});

describe('compileArray', () => {
  test('wraps children in brackets', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ mock: 'a' }],
    };
    compileArray(ctx, node);
    expect(ctx.emitted).toEqual(['[', 'a', ']']);
  });
});

describe('compileDict', () => {
  test('wraps children in braces', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ mock: 'pair1' }],
    };
    compileDict(ctx, node);
    expect(ctx.emitted).toEqual(['{', 'pair1', '}']);
  });
});

describe('compileNodeList', () => {
  test('compiles each child', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ mock: 'a' }, { mock: 'b' }],
    };
    compileNodeList(ctx, node);
    expect(ctx.emitted).toEqual(['a', 'b']);
  });
});

describe('compilePair', () => {
  test('compiles AstSymbol key as string literal', () => {
    const ctx = makeCtx();
    const node = {
      key: AstSymbol(1, 1, 'myKey'),
      value: { mock: 'val' },
    };
    compilePair(ctx, node, mockFrame);
    expect(ctx.emitted).toEqual(['LIT(myKey)', ': ', 'val']);
  });

  test('compiles Literal string key directly', () => {
    const ctx = makeCtx();
    const node = {
      key: Literal(1, 1, 'keyName'),
      value: { mock: 'val' },
    };
    compilePair(ctx, node, mockFrame);
    expect(ctx.emitted).toEqual(['LIT(keyName)', ': ', 'val']);
  });
});

describe('compileKeywordArgs', () => {
  test('wraps dict compile in runtime.makeKeywordArgs()', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ mock: 'pair' }],
    };
    compileKeywordArgs(ctx, node);
    expect(ctx.emitted).toEqual(['runtime.makeKeywordArgs(', '{', 'pair', '}', ')']);
  });
});

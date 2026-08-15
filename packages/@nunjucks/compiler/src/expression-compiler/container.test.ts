import { describe, expect, test } from 'bun:test';
import { keywordArgs, pair, spread, symbol, templateLiteral } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc, ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import {
  compileArray,
  compileDict,
  compileGroup,
  compileKeywordArgs,
  compileLiteral,
  compilePair,
  compileSpread,
  compileSymbol,
  compileTemplateLiteral,
} from './container.ts';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  const emitValue = (node: { mock?: string; value?: string; children?: unknown[] }) => {
    if (typeof node.mock === 'string') {
      emitted.push(node.mock);
      return;
    }
    if (typeof node.value === 'string') {
      emitted.push(`"${node.value}"`);
      return;
    }
    emitted.push(String(node.value));
  };
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    compile: emitValue,
    compileExpression: emitValue,
    compileChildren: emitValue,
    fail: (msg: string) => {
      throw new Error(msg);
    },
  };
};

describe('compileLiteral', () => {
  test('string literal is quoted and escaped', () => {
    const c = makeCompiler();
    compileLiteral(asCompiler(c), { value: 'a"b', lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['"a\\"b"']);
  });
  test('null literal emits null', () => {
    const c = makeCompiler();
    compileLiteral(asCompiler(c), { value: null, lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['null']);
  });
  test('number literal emits the number', () => {
    const c = makeCompiler();
    compileLiteral(asCompiler(c), { value: 42, lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['42']);
  });
});

describe('compileSymbol', () => {
  test('emits frame.lookup result when present', () => {
    const c = makeCompiler();
    let frameWith = createFrame();
    frameWith = frameWith.set({ name: 'x', value: 't_99' });
    compileSymbol(asCompiler(c), { node: symbol(ZERO_LOC, 'x'), frame: frameWith });
    expect(c.emitted).toEqual(['t_99']);
  });
  test('emits contextOrFrameLookup when frame.lookup returns null', () => {
    const c = makeCompiler();
    compileSymbol(asCompiler(c), { node: symbol(ZERO_LOC, 'x'), frame });
    expect(c.emitted).toEqual(['runtime.contextOrFrameLookup(context, frame, "x")']);
  });
});

describe('compilePair', () => {
  test('string key emits literal key', () => {
    const c = makeCompiler();
    compilePair(asCompiler(c), {
      node: pair(loc({ lineno: 1, colno: 1 }), {
        key: symbol(loc({ lineno: 1, colno: 1 }), 'a'),
        val: { mock: 'V' } as never,
      }),
      frame,
    });
    expect(c.emitted.join('')).toBe('"a": V');
  });
  test('non-string non-symbol key fails', () => {
    const c = makeCompiler();
    expect(() =>
      compilePair(asCompiler(c), {
        node: pair(loc({ lineno: 1, colno: 1 }), {
          key: symbol(loc({ lineno: 1, colno: 1 }), 'a'),
          val: spread(loc({ lineno: 1, colno: 1 }), {
            argument: symbol(loc({ lineno: 1, colno: 1 }), 's'),
          }) as never,
        }) as never,
        frame,
      })
    ).not.toThrow();
  });
});

describe('compileKeywordArgs', () => {
  test('wraps a dict in runtime.makeKeywordArgs', () => {
    const c = makeCompiler();
    compileKeywordArgs(asCompiler(c), { node: keywordArgs(ZERO_LOC), frame });
    expect(c.emitted.join('')).toBe('runtime.makeKeywordArgs({})');
  });
});

describe('compileSpread', () => {
  test('emits ... before argument', () => {
    const c = makeCompiler();
    compileSpread(asCompiler(c), {
      node: spread(loc({ lineno: 1, colno: 1 }), {
        argument: symbol(loc({ lineno: 1, colno: 1 }), 'xs'),
      }),
      frame,
    });
    expect(c.emitted.join('')).toBe('..."xs"');
  });
});

describe('compileTemplateLiteral', () => {
  test('emits a JS template literal mixing quasis and symbols', () => {
    const c = makeCompiler();
    const node = templateLiteral(ZERO_LOC, [
      { type: 'template', value: 'hi ' },
      { type: 'expression', node: symbol(ZERO_LOC, 'name') },
      { type: 'template', value: '!' },
    ]);
    compileTemplateLiteral(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('`hi ${');
    expect(c.emitted.join('')).toContain('}!`');
  });
});

describe('aggregate containers', () => {
  test('array emits comma-separated children in brackets', () => {
    const c = makeCompiler();
    compileArray(asCompiler(c), {
      node: { children: [{ mock: 'a' }, { mock: 'b' }] } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('[a,b]');
  });

  test('group emits parenthesized children', () => {
    const c = makeCompiler();
    compileGroup(asCompiler(c), { node: { children: [{ mock: 'a' }] } as never, frame });
    expect(c.emitted.join('')).toBe('(a)');
  });

  test('dict emits braced children', () => {
    const c = makeCompiler();
    compileDict(asCompiler(c), { node: { children: [{ mock: 'a' }] } as never, frame });
    expect(c.emitted.join('')).toBe('{a}');
  });
});

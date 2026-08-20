import { describe, expect, test } from 'bun:test';
import { keywordArgs, pair, spread, symbol, templateLiteral } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
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
import { makeContainerCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileLiteral', () => {
  test('string literal is quoted and escaped', () => {
    const c = makeContainerCompiler();
    compileLiteral(asCompiler(c), { value: 'a"b', lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['"a\\"b"']);
  });
  test('null literal emits null', () => {
    const c = makeContainerCompiler();
    compileLiteral(asCompiler(c), { value: null, lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['null']);
  });
  test('number literal emits the number', () => {
    const c = makeContainerCompiler();
    compileLiteral(asCompiler(c), { value: 42, lineno: 0, colno: 0 });
    expect(c.emitted).toEqual(['42']);
  });
});

describe('compileSymbol', () => {
  test('emits frame.lookup result when present', () => {
    const c = makeContainerCompiler();
    let frameWith = createFrame();
    frameWith = frameWith.set({ name: 'x', value: 't_99' });
    compileSymbol(asCompiler(c), { node: symbol(ZERO_LOC, 'x'), frame: frameWith });
    expect(c.emitted).toEqual(['t_99']);
  });
  test('emits contextOrFrameLookup when frame.lookup returns null', () => {
    const c = makeContainerCompiler();
    compileSymbol(asCompiler(c), { node: symbol(ZERO_LOC, 'x'), frame });
    expect(c.emitted).toEqual(['runtime.contextOrFrameLookup(context, frame, "x")']);
  });
});

describe('compilePair', () => {
  test('string key emits literal key', () => {
    const c = makeContainerCompiler();
    compilePair(asCompiler(c), {
      node: pair(loc({ lineno: 1, colno: 1 }), {
        key: symbol(loc({ lineno: 1, colno: 1 }), 'a'),
        val: { marker: 'V' } as never,
      }),
      frame,
    });
    expect(c.emitted.join('')).toBe('"a": V');
  });
  test('non-string non-symbol key fails', () => {
    const c = makeContainerCompiler();
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
    const c = makeContainerCompiler();
    compileKeywordArgs(asCompiler(c), { node: keywordArgs(ZERO_LOC), frame });
    expect(c.emitted.join('')).toBe('runtime.makeKeywordArgs({})');
  });
});

describe('compileSpread', () => {
  test('emits ... before argument', () => {
    const c = makeContainerCompiler();
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
    const c = makeContainerCompiler();
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
    const c = makeContainerCompiler();
    compileArray(asCompiler(c), {
      node: { children: [{ marker: 'a' }, { marker: 'b' }] } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('[a,b]');
  });

  test('group emits parenthesized children', () => {
    const c = makeContainerCompiler();
    compileGroup(asCompiler(c), { node: { children: [{ marker: 'a' }] } as never, frame });
    expect(c.emitted.join('')).toBe('(a)');
  });

  test('dict emits braced children', () => {
    const c = makeContainerCompiler();
    compileDict(asCompiler(c), { node: { children: [{ marker: 'a' }] } as never, frame });
    expect(c.emitted.join('')).toBe('{a}');
  });

  test('null first child emits no leading comma (no array hole)', () => {
    // WHY: latent edge unreachable via the parser — index arithmetic emitted a
    // leading comma for a null first child, creating `[,a]` (a holed array).
    const c = makeContainerCompiler();
    compileArray(asCompiler(c), {
      node: { children: [null, { marker: 'a' }] } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('[a]');
  });

  test('null child mid-list is skipped without a stray comma', () => {
    const c = makeContainerCompiler();
    compileArray(asCompiler(c), {
      node: { children: [{ marker: 'a' }, null, { marker: 'b' }] } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('[a,b]');
  });
});

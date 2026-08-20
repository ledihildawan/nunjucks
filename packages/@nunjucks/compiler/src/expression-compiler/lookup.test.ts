import { describe, expect, test } from 'bun:test';
import { funCall, lookupVal, optionalChain, slice, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler, makeChainableCompiler } from '../test-helpers.ts';
import { compileLookupVal, compileOptionalCall, compileOptionalChain } from './lookup.ts';
import { makeLookupCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileLookupVal', () => {
  test('member lookup emits runtime.memberLookup with parent name', () => {
    const c = makeLookupCompiler();
    const node = lookupVal(loc({ lineno: 1, colno: 1 }), {
      target: symbol(loc({ lineno: 1, colno: 1 }), 'obj'),
      val: symbol(loc({ lineno: 2, colno: 2 }), 'key'),
    });
    compileLookupVal(asCompiler(c), { node, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.memberLookup(("obj"),');
    expect(joined).toContain('"key"');
  });

  test('slice value emits runtime.slice with null bounds', () => {
    const c = makeLookupCompiler();
    const node = lookupVal(loc({ lineno: 1, colno: 1 }), {
      target: symbol(loc({ lineno: 1, colno: 1 }), 'arr'),
      val: slice(loc({ lineno: 2, colno: 2 }), { start: null, stop: null, step: null }),
    });
    compileLookupVal(asCompiler(c), { node, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain(
      'runtime.slice({ source: ("arr"), start: null, stop: null, step: null })'
    );
  });
});

describe('compileOptionalChain', () => {
  test('emits runtime.optionalMemberLookup', () => {
    const c = makeLookupCompiler();
    const node = optionalChain(loc({ lineno: 1, colno: 1 }), {
      target: symbol(loc({ lineno: 1, colno: 1 }), 'obj'),
      val: symbol(loc({ lineno: 2, colno: 2 }), 'key'),
    });
    compileOptionalChain(asCompiler(c), { node, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.optionalMemberLookup(("obj"),');
  });
});

describe('compileOptionalCall', () => {
  test('emits a null check around the callable', () => {
    const c = makeLookupCompiler();
    const node = funCall(loc({ lineno: 1, colno: 1 }), {
      name: symbol(loc({ lineno: 1, colno: 1 }), 'fn'),
      args: [symbol(loc({ lineno: 1, colno: 1 }), 'a')],
    });
    compileOptionalCall(asCompiler(c), { node, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('== null ? undefined :');
    // WHY: regression — the aggregate read a nonexistent `.children` off the CallNode
    // and silently dropped every argument; `fn?.(a)` must forward `a` to the call.
    expect(joined).toContain('"fn"("a")');
  });
});

describe('compileSlice', () => {
  test('a standalone slice node fails closed at dispatch (no source operand)', () => {
    const compiler = makeChainableCompiler();
    const node = slice(loc({ lineno: 1, colno: 1 }), {
      start: symbol(loc({ lineno: 1, colno: 1 }), 's'),
      stop: null,
      step: symbol(loc({ lineno: 1, colno: 1 }), 'p'),
    });
    // WHY: standalone SliceNode has no source — the parser only produces slices as a
    // LookupNode.val; dispatch intentionally routes hand-built ones to compiler.fail.
    expect(() => compiler.compile(node, frame)).toThrow();
  });
});

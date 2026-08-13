import { describe, test, expect } from 'bun:test';
import { compileLookupVal, compileOptionalChain, compileOptionalCall, compileSlice } from './lookup.ts';
import { symbol, lookupVal, optionalChain, slice, funCall } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  const emitNode = (node: { mock?: string; value?: string }) => {
    if (typeof node.mock === 'string') { emitted.push(node.mock); return; }
    if (typeof node.value === 'string') { emitted.push(`"${node.value}"`); return; }
  };
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    compile: emitNode,
    compileExpression: emitNode,
  };
};

describe('compileLookupVal', () => {
  test('member lookup emits runtime.memberLookup with parent name', () => {
    const c = makeCompiler();
    const node = lookupVal(loc({ lineno: 1, colno: 1 }), { target: { mock: 'OBJ' } as never, val: symbol(loc({ lineno: 2, colno: 2 }), 'key') });
    compileLookupVal(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.memberLookup((OBJ),');
    expect(joined).toContain('"key"');
  });

  test('slice value emits runtime.slice with null bounds', () => {
    const c = makeCompiler();
    const node = lookupVal(loc({ lineno: 1, colno: 1 }), { target: { mock: 'ARR' } as never, val: slice(loc({ lineno: 2, colno: 2 }), { start: null, stop: null, step: null }) });
    compileLookupVal(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.slice({ source: (ARR), start: null, stop: null, step: null })');
  });
});

describe('compileOptionalChain', () => {
  test('emits runtime.optionalMemberLookup', () => {
    const c = makeCompiler();
    const node = optionalChain(loc({ lineno: 1, colno: 1 }), { target: { mock: 'OBJ' } as never, val: symbol(loc({ lineno: 2, colno: 2 }), 'key') });
    compileOptionalChain(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.optionalMemberLookup((OBJ),');
  });
});

describe('compileOptionalCall', () => {
  test('emits a null check around the callable', () => {
    const c = makeCompiler();
    const node = funCall(loc({ lineno: 1, colno: 1 }), { name: { mock: 'FN' } as never, args: [{ mock: 'A' } as never] });
    compileOptionalCall(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('== null ? undefined :');
    expect(joined).toContain('FN()');
  });
});

describe('compileSlice', () => {
  test('emits runtime.slice with the three bounds', () => {
    const c = makeCompiler();
    const node = slice(loc({ lineno: 1, colno: 1 }), { start: { mock: 'S' } as never, stop: null, step: { mock: 'P' } as never });
    compileSlice(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.slice({ source: (');
    expect(joined).toContain(', start: null, stop: ');
  });
});
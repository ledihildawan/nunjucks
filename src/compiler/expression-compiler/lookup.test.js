import { describe, test, expect } from 'bun:test';
import { compileLookupVal, compileOptionalChain, compileSlice } from './lookup.js';
import { nodes } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
  };
};

describe('compileLookupVal', () => {
  test('emits memberLookup for non-slice val', () => {
    const ctx = makeCtx();
    compileLookupVal(ctx, {
      target: { mock: 'tgt' },
      val: { mock: 'prop' },
    });
    expect(ctx.emitted).toEqual([
      'runtime.memberLookup((', 'tgt', '),', 'prop', ')',
    ]);
  });

  test('emits slice helper for Slice val with all parts', () => {
    const ctx = makeCtx();
    const sliceVal = nodes.slice(1, 1, { mock: 'start' }, { mock: 'stop' }, { mock: 'step' });
    compileLookupVal(ctx, {
      target: { mock: 'arr' },
      val: sliceVal,
    });
    expect(ctx.emitted).toEqual([
      'runtime.slice((', 'arr', '), ', 'start', ', ', 'stop', ', ', 'step', ')',
    ]);
  });

  test('emits null for missing slice start/stop/step', () => {
    const ctx = makeCtx();
    const sliceVal = nodes.slice(1, 1, null, null, null);
    compileLookupVal(ctx, {
      target: { mock: 'arr' },
      val: sliceVal,
    });
    expect(ctx.emitted).toEqual([
      'runtime.slice((', 'arr', '), ', 'null', ', ', 'null', ', ', 'null', ')',
    ]);
  });
});

describe('compileOptionalChain', () => {
  test('emits optionalMemberLookup', () => {
    const ctx = makeCtx();
    compileOptionalChain(ctx, {
      target: { mock: 'tgt' },
      val: { mock: 'prop' },
    });
    expect(ctx.emitted).toEqual([
      'runtime.optionalMemberLookup((', 'tgt', '),', 'prop', ')',
    ]);
  });
});

describe('compileSlice', () => {
  test('emits runtime.slice with all parts', () => {
    const ctx = makeCtx();
    compileSlice(ctx, {
      start: { mock: 's' },
      stop: { mock: 'e' },
      step: { mock: 'p' },
    });
    expect(ctx.emitted).toEqual([
      'runtime.slice((', 's', '), (', 'e', '), (', 'p', '))',
    ]);
  });

  test('emits null for missing parts', () => {
    const ctx = makeCtx();
    compileSlice(ctx, {
      start: null,
      stop: null,
      step: null,
    });
    expect(ctx.emitted).toEqual([
      'runtime.slice((', 'null', '), (', 'null', '), (', 'null', '))',
    ]);
  });
});

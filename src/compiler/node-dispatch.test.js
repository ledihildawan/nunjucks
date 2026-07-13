import { describe, test, expect } from 'bun:test';
import { COMPILE_FUNCTIONS, compileDispatch } from './node-dispatch.js';
import { nodes } from '../nodes/index.js';

describe('COMPILE_FUNCTIONS', () => {
  test('has entries for all expected node types', () => {
    const expected = [
      'literal', 'symbol', 'group', 'array', 'dict', 'nodeList', 'pair',
      'inlineIf', 'in', 'is', 'or', 'and', 'nullishCoalesce',
      'add', 'concat', 'sub', 'mul', 'div', 'mod', 'not',
      'floorDiv', 'pow', 'neg', 'pos',
      'compare', 'lookupVal', 'optionalChain', 'optionalCall', 'slice',
      'funCall', 'pipe', 'pipeAsync', 'keywordArgs',
      'set', 'switch', 'if', 'for',
      'macro', 'caller', 'import', 'fromImport',
      'block', 'super', 'extends', 'include', 'templateData',
      'capture', 'output', 'callExtension', 'callExtensionAsync',
      'root',
    ];
    for (const name of expected) {
      expect(COMPILE_FUNCTIONS[name]).toBeDefined();
    }
  });

  test('has the correct count', () => {
    expect(Object.keys(COMPILE_FUNCTIONS).length).toBeGreaterThanOrEqual(51);
  });
});

describe('compileDispatch', () => {
  test('calls the correct function for node typename', () => {
    const orig = COMPILE_FUNCTIONS.literal;
    try {
      const called = [];
      const ctx = {
        fail: () => { throw new Error('fail'); },
      };
      COMPILE_FUNCTIONS.literal = (c, n) => { called.push('literal'); };
      const node = nodes.literal(0, 0, 'test');
      compileDispatch(ctx, node);
      expect(called).toEqual(['literal']);
    } finally {
      COMPILE_FUNCTIONS.literal = orig;
    }
  });

  test('calls fail for unknown typename', () => {
    const ctx = {
      fail: (msg, lineno, colno) => { throw new Error(msg); },
    };
    const node = { lineno: 1, colno: 1 };
    expect(() => compileDispatch(ctx, node)).toThrow();
  });
});

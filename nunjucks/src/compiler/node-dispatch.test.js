import { describe, test, expect } from 'bun:test';
import { COMPILE_FUNCTIONS, compileDispatch } from './node-dispatch.js';

describe('COMPILE_FUNCTIONS', () => {
  test('has entries for all expected node types', () => {
    const expected = [
      'Literal', 'Symbol', 'Group', 'Array', 'Dict', 'NodeList', 'Pair',
      'InlineIf', 'In', 'Is', 'Or', 'And', 'NullishCoalesce',
      'Add', 'Concat', 'Sub', 'Mul', 'Div', 'Mod', 'Not',
      'FloorDiv', 'Pow', 'Neg', 'Pos',
      'Compare', 'LookupVal', 'OptionalChain', 'Slice',
      'FunCall', 'Pipe', 'PipeAsync', 'KeywordArgs',
      'Set', 'Switch', 'If', 'IfAsync', 'For', 'AsyncEach', 'AsyncAll',
      'Macro', 'Caller', 'Import', 'FromImport',
      'Block', 'Super', 'Extends', 'Include', 'TemplateData',
      'Capture', 'Output', 'CallExtension', 'CallExtensionAsync',
      'Root',
    ];
    for (const name of expected) {
      expect(COMPILE_FUNCTIONS[name]).toBeDefined();
    }
  });

  test('has the correct count', () => {
    expect(Object.keys(COMPILE_FUNCTIONS).length).toBe(53);
  });
});

describe('compileDispatch', () => {
  test('calls the correct function for node typename', () => {
    const called = [];
    const ctx = {
      fail: () => { throw new Error('fail'); },
    };
    COMPILE_FUNCTIONS.Literal = (c, n) => { called.push('literal'); };
    const node = { typename: 'Literal' };
    compileDispatch(ctx, node);
    expect(called).toEqual(['literal']);
  });

  test('calls fail for unknown typename', () => {
    const ctx = {
      fail: (msg, lineno, colno) => { throw new Error(msg); },
    };
    const node = { typename: 'Unknown', lineno: 1, colno: 1 };
    expect(() => compileDispatch(ctx, node)).toThrow('Cannot compile node: Unknown');
  });
});

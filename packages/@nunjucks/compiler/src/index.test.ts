import { describe, test, expect, beforeEach } from 'bun:test';
import { createCompiler } from '@nunjucks/compiler';
import { symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';

let compiler: ReturnType<typeof createCompiler>;

beforeEach(() => {
  compiler = createCompiler('test.njk', 'chainable', 'source');
});

describe('Compiler', () => {
  test('fail throws TemplateError', () => {
    expect(() => compiler.fail('msg', 1, 2)).toThrow();
    expect(() => compiler.fail('msg', 1, 2)).toThrow('msg');
  });

  test('getTemplateName returns JSON string', () => {
    expect(compiler.getTemplateName()).toBe('"test.njk"');
  });

  test('getTemplateName returns undefined for null name', () => {
    const c = createCompiler(null, undefined, '');
    expect(c.getTemplateName()).toBe('undefined');
  });

  test('compileExpression throws for invalid type', () => {
    const invalidNode = { type: 'Unknown', lineno: 1, colno: 1 } as never;
    expect(() => compiler.compileExpression(invalidNode, createFrame())).toThrow();
  });

  test('assertType throws for non-matching type', () => {
    expect(() => compiler.assertType(symbol(1, 1, 'x'), 'literal')).toThrow('assertType');
  });

  test('getCode returns compiled code', () => {
    compiler.emtest('a');
    compiler.emtest('b');
    expect(compiler.getCode()).toBe('ab');
  });
});

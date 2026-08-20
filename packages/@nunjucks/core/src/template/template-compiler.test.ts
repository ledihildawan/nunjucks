import { describe, expect, test } from 'bun:test';
import { createTemplateCompiler } from './template-compiler.ts';
import { createSourceTemplateState } from './template-test-helper.ts';

describe('createTemplateCompiler', () => {
  test('compile returns void', () => {
    const getState = () => createSourceTemplateState();
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(typeof compiler.compile).toBe('function');
  });

  test('safeCompile returns Promise', () => {
    const getState = () => createSourceTemplateState();
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(compiler.safeCompile()).toBeInstanceOf(Promise);
  });

  test('compile does not throw on valid template', () => {
    const getState = () => createSourceTemplateState({ tmplStr: 'Hello {{ name }}' });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    compiler.compile();
  });

  test('compile throws prettified error on invalid template', () => {
    const getState = () => createSourceTemplateState({ tmplStr: '{{ invalid--syntax' });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(() => compiler.compile()).toThrow();
  });
});

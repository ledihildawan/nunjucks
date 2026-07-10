import { describe, test, expect } from 'bun:test';
import { createPrecompiledLoader, PrecompiledLoader } from './precompiled.js';

describe('createPrecompiledLoader', () => {
  test('creates loader that returns precompiled template', () => {
    const obj = { tmpl: 'function(){}' };
    const loader = createPrecompiledLoader({ 'hello.html': obj });
    const source = loader.getSource('hello.html');
    expect(source.src).toEqual({ type: 'code', obj });
    expect(source.path).toBe('hello.html');
  });

  test('returns null for missing template', () => {
    const loader = createPrecompiledLoader({});
    expect(loader.getSource('missing.html')).toBeNull();
  });

  test('defaults to empty compiledTemplates', () => {
    const loader = createPrecompiledLoader();
    expect(loader.getSource('any')).toBeNull();
  });
});

describe('PrecompiledLoader', () => {
  test('constructor stores precompiled templates', () => {
    const loader = new PrecompiledLoader({ 'a.html': { tmpl: 'fn' } });
    expect(loader.precompiled['a.html']).toEqual({ tmpl: 'fn' });
  });

  test('getSource returns precompiled template', () => {
    const obj = { tmpl: 'fn' };
    const loader = new PrecompiledLoader({ 't.html': obj });
    const source = loader.getSource('t.html');
    expect(source.src).toEqual({ type: 'code', obj });
  });

  test('getSource returns null for missing template', () => {
    const loader = new PrecompiledLoader({});
    expect(loader.getSource('x')).toBeNull();
  });
});

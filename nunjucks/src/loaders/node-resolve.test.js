import { describe, test, expect } from 'bun:test';
import { NodeResolveLoader } from './node-resolve.js';
import Loader from './base.js';

describe('NodeResolveLoader', () => {
  test('extends Loader', () => {
    const loader = new NodeResolveLoader();
    expect(loader).toBeInstanceOf(Loader);
  });

  test('constructor sets options', () => {
    const loader = new NodeResolveLoader({ noCache: true, paths: ['/custom/path'] });
    expect(loader.noCache).toBe(true);
    expect(loader.paths).toEqual(['/custom/path']);
    expect(loader.async).toBe(true);
  });

  test('constructor defaults', () => {
    const loader = new NodeResolveLoader();
    expect(loader.noCache).toBe(false);
    expect(loader.paths).toEqual([]);
  });

  test('getSource returns null for relative paths (./)', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('./foo.njk');
    expect(result).toBeNull();
  });

  test('getSource returns null for relative paths (../)', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('../foo.njk');
    expect(result).toBeNull();
  });

  test('getSource returns null for Windows absolute paths', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('C:\\foo.njk');
    expect(result).toBeNull();
  });

  test('getSource resolves real module names', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('remeda');
    expect(result).not.toBeNull();
    expect(result.src).toBeTruthy();
    expect(result.path).toBeTruthy();
  });

  test('getSource returns null for unknown module', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('this-module-definitely-does-not-exist-12345');
    expect(result).toBeNull();
  });

  test('getSource emits load event for resolved module', async () => {
    const loader = new NodeResolveLoader();
    let emitted = null;
    loader.on('load', (name, source) => { emitted = { name, source }; });

    await loader.getSource('remeda');

    expect(emitted).not.toBeNull();
    expect(emitted.name).toBe('remeda');
    expect(emitted.source.path).toBeTruthy();
  });

  test('getSource sets pathsToNames mapping', async () => {
    const loader = new NodeResolveLoader();
    const result = await loader.getSource('remeda');
    expect(loader.pathsToNames[result.path]).toBe('remeda');
  });

  test('getSource with noCache set', async () => {
    const loader = new NodeResolveLoader({ noCache: true });
    const result = await loader.getSource('remeda');
    expect(result.noCache).toBe(true);
  });
});

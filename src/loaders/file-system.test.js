import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFileSystemLoader } from './file-system.js';
import { isLoader } from './base.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'njk-test-'));
  writeFileSync(join(tmpDir, 'hello.njk'), 'Hello {{ name }}');
  writeFileSync(join(tmpDir, 'world.njk'), 'World');
  mkdirSync(join(tmpDir, 'sub'));
  writeFileSync(join(tmpDir, 'sub', 'nested.njk'), 'Nested');
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe('FileSystemLoader', () => {
  test('creates loader with symbol marker', () => {
    const loader = createFileSystemLoader(tmpDir);
    expect(isLoader(loader)).toBe(true);
  });

  test('constructor normalizes search paths', () => {
    const loader = createFileSystemLoader(tmpDir);
    expect(loader.searchPaths).toEqual([tmpDir.replace(/\//g, '\\')]);
  });

  test('constructor defaults searchPaths to ["."]', () => {
    const loader = createFileSystemLoader();
    expect(loader.searchPaths).toEqual(['.']);
  });

  test('constructor sets noCache from opts', () => {
    const loader = createFileSystemLoader(tmpDir, { noCache: true });
    expect(loader.noCache).toBe(true);
  });

  test('constructor sets watch from opts', () => {
    const loader = createFileSystemLoader(tmpDir, { watch: true });
    expect(loader.watchEnabled).toBe(true);
  });

  test('getSource returns source for existing file', async () => {
    const loader = createFileSystemLoader(tmpDir);
    const result = await loader.getSource('hello.njk');
    expect(result.src).toBe('Hello {{ name }}');
    expect(result.path).toBe(join(tmpDir, 'hello.njk'));
  });

  test('getSource returns null for missing file', async () => {
    const loader = createFileSystemLoader(tmpDir);
    const result = await loader.getSource('missing.njk');
    expect(result).toBeNull();
  });

  test('getSource finds file in subdirectory', async () => {
    const loader = createFileSystemLoader(tmpDir);
    const result = await loader.getSource('sub/nested.njk');
    expect(result.src).toBe('Nested');
  });

  test('getSource emits load event', async () => {
    const loader = createFileSystemLoader(tmpDir);
    let emitted = null;
    loader.on('load', (name, source) => { emitted = { name, source }; });

    await loader.getSource('hello.njk');

    expect(emitted).not.toBeNull();
    expect(emitted.name).toBe('hello.njk');
  });

  test('watches file when watchEnabled is true', async () => {
    const loader = createFileSystemLoader(tmpDir, { watch: true });
    await loader.getSource('hello.njk');

    expect(loader.watchedFiles.size).toBe(1);
    const watcher = loader.watchedFiles.get(join(tmpDir, 'hello.njk'));
    expect(watcher).toBeDefined();
  });

  test('unwatchFile removes watcher', () => {
    const loader = createFileSystemLoader(tmpDir, { watch: true });
    const filePath = join(tmpDir, 'hello.njk');

    loader.watchFile(filePath);
    expect(loader.watchedFiles.size).toBe(1);

    loader.unwatchFile(filePath);
    expect(loader.watchedFiles.size).toBe(0);
  });

  test('unwatchAll removes all watchers', () => {
    const loader = createFileSystemLoader(tmpDir, { watch: true });
    loader.watchFile(join(tmpDir, 'hello.njk'));
    loader.watchFile(join(tmpDir, 'world.njk'));

    expect(loader.watchedFiles.size).toBe(2);

    loader.unwatchAll();
    expect(loader.watchedFiles.size).toBe(0);
  });

  test('multiple search paths', async () => {
    const otherDir = mkdtempSync(join(tmpdir(), 'njk-other-'));
    try {
      writeFileSync(join(otherDir, 'other.njk'), 'Other');
      const loader = createFileSystemLoader([tmpDir, otherDir]);
      const result = await loader.getSource('other.njk');
      expect(result.src).toBe('Other');
    } finally {
      if (existsSync(otherDir)) rmSync(otherDir, { recursive: true });
    }
  });
});

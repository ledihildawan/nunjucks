import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isOk } from '@nunjucks/lib';
import { createFileSystemLoader } from './file-system.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {}))
  );
});

const makeDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nj-loader-'));
  tempDirs.push(dir);
  return dir;
};

describe('createFileSystemLoader', () => {
  test('creates loader with default search path "."', () => {
    const loader = createFileSystemLoader(undefined);
    expect(loader.searchPaths).toEqual(['.']);
    expect(loader.async).toBe(true);
    expect(loader.watchEnabled).toBe(false);
    expect(loader.pathsToNames).toBeInstanceOf(Map);
  });

  test('creates loader with single search path', () => {
    const loader = createFileSystemLoader('/tmp/templates');
    expect(loader.searchPaths).toEqual([expect.stringContaining('tmp')]);
  });

  test('creates loader with multiple search paths', () => {
    const loader = createFileSystemLoader(['/a', '/b']);
    expect(loader.searchPaths.length).toBe(2);
  });

  test('creates loader with watch enabled', () => {
    const loader = createFileSystemLoader('.', { watch: true });
    expect(loader.watchEnabled).toBe(true);
  });
});

describe('getSource', () => {
  test('loads existing template file', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'hello.njk'), 'Hello {{ name }}');
    const loader = createFileSystemLoader(dir);
    const result = await loader.getSource('hello.njk');
    expect(result).not.toBeNull();
    if (result !== null && isOk(result)) {
      expect(result.value.src).toBe('Hello {{ name }}');
      expect(result.value.path).toContain('hello.njk');
    }
  });

  test('returns null for non-existent file', async () => {
    const dir = await makeDir();
    const loader = createFileSystemLoader(dir);
    const source = await loader.getSource('missing.njk');
    expect(source).toBeNull();
  });

  test('searches multiple paths in order', async () => {
    const primarySearchDir = await makeDir();
    const secondarySearchDir = await makeDir();
    await writeFile(join(secondarySearchDir, 'shared.njk'), 'from dir2');
    const loader = createFileSystemLoader([primarySearchDir, secondarySearchDir]);
    const result = await loader.getSource('shared.njk');
    expect(result).not.toBeNull();
    if (result !== null && isOk(result)) {
      expect(result.value.src).toBe('from dir2');
    }
  });

  test('prefers first path when file exists in both', async () => {
    const primarySearchDir = await makeDir();
    const secondarySearchDir = await makeDir();
    await Promise.all([
      writeFile(join(primarySearchDir, 'both.njk'), 'from dir1'),
      writeFile(join(secondarySearchDir, 'both.njk'), 'from dir2'),
    ]);
    const loader = createFileSystemLoader([primarySearchDir, secondarySearchDir]);
    const result = await loader.getSource('both.njk');
    expect(result).not.toBeNull();
    if (result !== null && isOk(result)) {
      expect(result.value.src).toBe('from dir1');
    }
  });

  test('throws on directory path', async () => {
    const dir = await makeDir();
    await mkdir(join(dir, 'subdir'));
    const loader = createFileSystemLoader(dir);
    const result = await loader.getSource('subdir');
    expect(result).not.toBeNull();
    if (result !== null && !isOk(result)) {
      expect(result.error.message).toContain('EISDIR');
    }
  });

  test('records loaded file in pathsToNames', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'tracked.njk'), 'content');
    const loader = createFileSystemLoader(dir);
    await loader.getSource('tracked.njk');
    const keys = Array.from(loader.pathsToNames.keys());
    expect(keys.length).toBe(1);
    expect(keys[0]).toContain('tracked.njk');
  });
});

describe('path traversal protection', () => {
  test('blocks access outside search path via ..', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'secret.njk'), 'secret');
    const subdir = join(dir, 'templates');
    await mkdir(subdir);
    const loader = createFileSystemLoader(subdir);
    const source = await loader.getSource('../secret.njk');
    expect(source).toBeNull();
  });

  test('blocks a sibling directory that shares a name prefix (startsWith bypass)', async () => {
    const root = await makeDir();
    const baseDir = join(root, 'templates');
    const siblingDir = join(root, 'templates-secret');
    await mkdir(baseDir);
    await mkdir(siblingDir);
    await writeFile(join(siblingDir, 'evil.njk'), 'pwned');
    const loader = createFileSystemLoader(baseDir);
    const source = await loader.getSource('../templates-secret/evil.njk');
    expect(source).toBeNull();
  });

  test('rejects template names containing a null byte', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'safe.njk'), 'content');
    const loader = createFileSystemLoader(dir);
    const source = await loader.getSource('safe.njk\0.evil');
    expect(source).toBeNull();
  });
});

describe('watch', () => {
  test('watchFile adds watcher and unwatchFile removes it', async () => {
    const dir = await makeDir();
    const file = join(dir, 'watched.njk');
    await writeFile(file, 'content');
    const loader = createFileSystemLoader(dir, { watch: true });
    loader.watchFile(file);
    expect(loader.watchedFiles.has(file)).toBe(true);
    loader.unwatchFile(file);
    expect(loader.watchedFiles.has(file)).toBe(false);
  });

  test('unwatchAll clears all watchers', async () => {
    const dir = await makeDir();
    const firstWatchedFile = join(dir, 'a.njk');
    const secondWatchedFile = join(dir, 'b.njk');
    await Promise.all([writeFile(firstWatchedFile, 'a'), writeFile(secondWatchedFile, 'b')]);
    const loader = createFileSystemLoader(dir, { watch: true });
    loader.watchFile(firstWatchedFile);
    loader.watchFile(secondWatchedFile);
    expect(loader.watchedFiles.size).toBe(2);
    loader.unwatchAll();
    expect(loader.watchedFiles.size).toBe(0);
  });

  test('does not double-watch same file', async () => {
    const dir = await makeDir();
    const file = join(dir, 'once.njk');
    await writeFile(file, 'x');
    const loader = createFileSystemLoader(dir, { watch: true });
    loader.watchFile(file);
    loader.watchFile(file);
    expect(loader.watchedFiles.size).toBe(1);
  });

  test('a failing watcher is deleted from the registry and emits a catalogued error', async () => {
    const dir = await makeDir();
    const file = join(dir, 'failing.njk');
    await writeFile(file, 'x');
    const loader = createFileSystemLoader(dir, { watch: true });
    loader.watchFile(file);
    const emitted: unknown[] = [];
    loader.on('error', (error) => emitted.push(error));

    // WHY: deterministic trigger — drive the watcher's own error event instead of
    // waiting for a real fs failure.
    loader.watchedFiles.get(file)?.emit('error', new Error('EPIPE'));

    expect(loader.watchedFiles.has(file)).toBe(false);
    expect(emitted).toHaveLength(1);
    expect((emitted[0] as { name: string }).name).toBe('Template render error');
    expect((emitted[0] as { message: string }).message).toContain('watch failed');
  });
});

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, open, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
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

  describe('source memo', () => {
    test('a memo hit returns the same source object without re-reading', async () => {
      const dir = await makeDir();
      const file = join(dir, 'memo.njk');
      await writeFile(file, 'stable content');
      const loader = createFileSystemLoader(dir);
      const first = await loader.getSource('memo.njk');
      const second = await loader.getSource('memo.njk');
      expect(first !== null && isOk(first)).toBe(true);
      expect(second !== null && isOk(second)).toBe(true);
      if (first !== null && second !== null && isOk(first) && isOk(second)) {
        // WHY: toBe — the memo must return the memoized object identity
        expect(second.value).toBe(first.value);
      }
    });

    test('rewriting the file (new mtime) busts the memo on the next getSource', async () => {
      const dir = await makeDir();
      const file = join(dir, 'mutable.njk');
      await writeFile(file, 'before');
      const loader = createFileSystemLoader(dir);
      const first = await loader.getSource('mutable.njk');
      // WHY: backdate mtime instead of sleeping — the rewrite is then guaranteed a
      // strictly-greater mtime on every filesystem, regardless of timestamp granularity.
      const staleTime = new Date(Date.now() - 60_000);
      await utimes(file, staleTime, staleTime);
      await writeFile(file, 'after');
      const second = await loader.getSource('mutable.njk');
      expect(first !== null && isOk(first)).toBe(true);
      expect(second !== null && isOk(second)).toBe(true);
      if (first !== null && second !== null && isOk(first) && isOk(second)) {
        expect(first.value.src).toBe('before');
        expect(second.value.src).toBe('after');
      }
    });

    test('memo:false disables memoization entirely', async () => {
      const dir = await makeDir();
      const file = join(dir, 'off.njk');
      await writeFile(file, 'x');
      const loader = createFileSystemLoader(dir, { memo: false });
      const first = await loader.getSource('off.njk');
      const second = await loader.getSource('off.njk');
      expect(first !== null && isOk(first)).toBe(true);
      expect(second !== null && isOk(second)).toBe(true);
      if (first !== null && second !== null && isOk(first) && isOk(second)) {
        expect(second.value).not.toBe(first.value);
        expect(second.value.src).toBe(first.value.src);
      }
    });

    test('deleting a memoized file degrades to a miss (memo dropped, not stale)', async () => {
      const dir = await makeDir();
      const file = join(dir, 'gone.njk');
      await writeFile(file, 'temp');
      const loader = createFileSystemLoader(dir);
      const first = await loader.getSource('gone.njk');
      expect(first !== null && isOk(first)).toBe(true);
      await rm(file);
      expect(await loader.getSource('gone.njk')).toBeNull();
    });

    test('a file created later at a higher-precedence search path displaces the memo', async () => {
      const primarySearchDir = await makeDir();
      const secondarySearchDir = await makeDir();
      await writeFile(join(secondarySearchDir, 'late.njk'), 'from secondary');
      const loader = createFileSystemLoader([primarySearchDir, secondarySearchDir]);
      const first = await loader.getSource('late.njk');
      expect(first !== null && isOk(first) && first.value.src === 'from secondary').toBe(true);

      // WHY: the memo holds an entry keyed at the secondary path; creating the file
      // at the primary path must win on the next getSource — the memo may not keep
      // serving the lower-precedence entry forever.
      await writeFile(join(primarySearchDir, 'late.njk'), 'from primary');
      const second = await loader.getSource('late.njk');
      expect(second !== null && isOk(second)).toBe(true);
      if (second !== null && isOk(second)) {
        expect(second.value.src).toBe('from primary');
      }
    });
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

describe('descriptor-pinned read (TOCTOU closure)', () => {
  test('serves normal files through the descriptor path with identical content', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'fd.njk'), 'descriptor content');
    const loader = createFileSystemLoader(dir, { memo: false });
    const first = await loader.getSource('fd.njk');
    const second = await loader.getSource('fd.njk');
    expect(first !== null && isOk(first) && first.value.src === 'descriptor content').toBe(true);
    expect(second !== null && isOk(second) && second.value.src === 'descriptor content').toBe(true);
    if (first !== null && second !== null && isOk(first) && isOk(second)) {
      expect(second.value.path).toBe(first.value.path);
    }
  });

  test('memo still validates on top of the descriptor read (same object identity)', async () => {
    const dir = await makeDir();
    const file = join(dir, 'fdmemo.njk');
    await writeFile(file, 'memoized via fd');
    const loader = createFileSystemLoader(dir);
    const first = await loader.getSource('fdmemo.njk');
    const second = await loader.getSource('fdmemo.njk');
    expect(first !== null && isOk(first)).toBe(true);
    expect(second !== null && isOk(second)).toBe(true);
    if (first !== null && second !== null && isOk(first) && isOk(second)) {
      // WHY: toBe — a consult hit must return the memoized object identity,
      // proving remember() still keys on the descriptor-fstat (mtimeMs, size).
      expect(second.value).toBe(first.value);
      expect(second.value.src).toBe('memoized via fd');
    }
  });

  test('stat and fstat agree on (dev, ino) for a resolved template', async () => {
    const dir = await makeDir();
    const file = join(dir, 'identity.njk');
    await writeFile(file, 'identity probe');
    const pathStat = await stat(file);
    const handle = await open(file, 'r');
    try {
      const fdStat = await handle.stat();
      expect(fdStat.isSymbolicLink()).toBe(false);
      // WHY: the identity guard compares validation stat against fd fstat — if a
      // runtime ever disagreed on (dev, ino) for the same inode, every read would
      // retry then fail closed, so the pair must match by construction.
      expect(fdStat.dev).toBe(pathStat.dev);
      expect(fdStat.ino).toBe(pathStat.ino);
    } finally {
      await handle.close();
    }
    const loader = createFileSystemLoader(dir);
    const result = await loader.getSource('identity.njk');
    expect(result !== null && isOk(result) && result.value.src === 'identity probe').toBe(true);
  });

  test.skipIf(process.platform === 'win32')(
    'a symlink inside the root pointing outside is rejected at validation',
    async () => {
      const root = await makeDir();
      const outsideDir = await makeDir();
      const secret = join(outsideDir, 'secret.njk');
      await writeFile(secret, 'outside secret');
      await symlink(secret, join(root, 'escape.njk'));
      const loader = createFileSystemLoader(root);
      // WHY: realpath containment rejects the escape before any read — the
      // descriptor identity check is the second gate, not the only one.
      expect(await loader.getSource('escape.njk')).toBeNull();
    }
  );
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

  test('a real disk change emits update and the next getSource reads fresh content', async () => {
    const dir = await makeDir();
    const file = join(dir, 'live.njk');
    await writeFile(file, 'before');
    const loader = createFileSystemLoader(dir, { watch: true });

    const first = await loader.getSource('live.njk');
    expect(first !== null && isOk(first) && first.value.src === 'before').toBe(true);
    // getSource auto-attached the watcher for the resolved path
    expect(loader.watchedFiles.has(file)).toBe(true);

    const updateArrived = new Promise<string>((resolve) => {
      loader.on('update', (name) => resolve(String(name)));
    });
    // WHY: backdate + rewrite guarantees a strictly-greater mtime on every filesystem,
    // so the memo consult must bust even where timestamp granularity is coarse.
    const staleTime = new Date(Date.now() - 60_000);
    await utimes(file, staleTime, staleTime);
    await writeFile(file, 'after');

    const timeoutSentinel = '_timeout_';
    const eventName = await Promise.race([
      updateArrived,
      new Promise<string>((resolve) => setTimeout(() => resolve(timeoutSentinel), 3000)),
    ]);
    expect(eventName).not.toBe(timeoutSentinel);
    // WHY: the update payload must be the template NAME (the cache key callers
    // invalidate), resolved via pathsToNames — not the raw fs-reported filename.
    expect(eventName).toBe('live.njk');

    const second = await loader.getSource('live.njk');
    expect(second !== null && isOk(second) && second.value.src === 'after').toBe(true);

    loader.unwatchAll();
  });

  test('update emits the template NAME including its directory, not the bare filename', async () => {
    const dir = await makeDir();
    const subDir = join(dir, 'sub');
    await mkdir(subDir);
    const file = join(subDir, 'page.njk');
    await writeFile(file, 'before');
    const loader = createFileSystemLoader(dir, { watch: true });

    await loader.getSource('sub/page.njk');

    const updateArrived = new Promise<string>((resolve) => {
      loader.on('update', (name) => resolve(String(name)));
    });
    const staleTime = new Date(Date.now() - 60_000);
    await utimes(file, staleTime, staleTime);
    await writeFile(file, 'after');

    const timeoutSentinel = '_timeout_';
    const eventName = await Promise.race([
      updateArrived,
      new Promise<string>((resolve) => setTimeout(() => resolve(timeoutSentinel), 3000)),
    ]);
    expect(eventName).not.toBe(timeoutSentinel);
    expect(eventName).toBe('sub/page.njk');

    loader.unwatchAll();
  });
});

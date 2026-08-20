import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isOk } from '@nunjucks/lib';
import type { TemplateLoaderSource } from './loader-chain.ts';
import { createSourceMemo, type SourceMemo } from './source-memo.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {}))
  );
});

const makeDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nj-source-memo-'));
  tempDirs.push(dir);
  return dir;
};

const makeSource = (content: string, fullPath: string): TemplateLoaderSource => ({
  src: content,
  path: fullPath,
});

// WHY: remember takes caller-supplied stats — capture them where validation does,
// right after the write and before any (simulated) read.
const rememberFile = async (memo: SourceMemo, fullPath: string, content: string) => {
  await memo.remember(fullPath, makeSource(content, fullPath), await stat(fullPath));
};

describe('createSourceMemo', () => {
  test('consult returns null when nothing was ever remembered', async () => {
    const dir = await makeDir();
    const memo = createSourceMemo();
    expect(await memo.consult([dir], 'unknown.njk')).toBeNull();
  });

  test('remember then consult answers with the memoized source identity', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'stable.njk');
    await writeFile(fullPath, 'stable content');
    const memo = createSourceMemo();
    const source = makeSource('stable content', fullPath);
    await memo.remember(fullPath, source, await stat(fullPath));

    const hit = await memo.consult([dir], 'stable.njk');
    expect(hit !== null && isOk(hit)).toBe(true);
    if (hit !== null && isOk(hit)) {
      // WHY: toBe — an unchanged file must answer with the memoized object identity,
      // not a fresh read (that identity skip is the memo's whole value).
      expect(hit.value).toBe(source);
    }
  });

  test('a size change busts the memo on the next consult', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'resized.njk');
    await writeFile(fullPath, 'short');
    const memo = createSourceMemo();
    await rememberFile(memo, fullPath, 'short');

    await writeFile(fullPath, 'noticeably longer content');
    expect(await memo.consult([dir], 'resized.njk')).toBeNull();
  });

  test('an mtime change busts the memo even when the size is identical', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'touched.njk');
    await writeFile(fullPath, 'same size');
    const memo = createSourceMemo();
    await rememberFile(memo, fullPath, 'same size');

    // WHY: backdate mtime after remember — the stored stat pair no longer matches,
    // deterministically, without sleeping or relying on write-timestamp granularity.
    const staleTime = new Date(Date.now() - 60_000);
    await utimes(fullPath, staleTime, staleTime);
    expect(await memo.consult([dir], 'touched.njk')).toBeNull();
  });

  test('deleting the file drops the memo entry and reports a miss', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'doomed.njk');
    await writeFile(fullPath, 'vanishing');
    const memo = createSourceMemo();
    await rememberFile(memo, fullPath, 'vanishing');

    await unlink(fullPath);
    expect(await memo.consult([dir], 'doomed.njk')).toBeNull();
  });

  test('remember never touches the filesystem — a vanished path is consult-worthy only', async () => {
    const dir = await makeDir();
    const ghostPath = join(dir, 'ghost.njk');
    const memo = createSourceMemo();
    // WHY: stats from an unrelated inode suffice — remember only reads mtimeMs/size,
    // so recording a path that does not exist must succeed and store the entry.
    const borrowedStats = await stat(dir);

    await expect(
      memo.remember(ghostPath, makeSource('never', ghostPath), borrowedStats)
    ).resolves.toBeUndefined();
    expect(await memo.consult([dir], 'ghost.njk')).toBeNull();
  });

  test('remember keys on pre-read stats: a post-read write busts the memo, never serves stale', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'raced.njk');
    await writeFile(fullPath, 'v1');
    const memo = createSourceMemo();
    // WHY: stats captured where validation captures them — BEFORE the content read.
    const preReadStats = await stat(fullPath);
    await memo.remember(fullPath, makeSource('v1', fullPath), preReadStats);

    // WHY: deterministic read/write race — the write lands after the read (memoized
    // content is 'v1') and the memo must keep the pre-read stat pair, so consult
    // mismatches and defers to a fresh read instead of answering stale content.
    // Different length guarantees the pair differs even on coarse mtime granularity.
    await writeFile(fullPath, 'v2 with a different length');
    expect(await memo.consult([dir], 'raced.njk')).toBeNull();
  });

  test('consult prefers the first search path that holds a memo entry', async () => {
    const firstDir = await makeDir();
    const secondDir = await makeDir();
    const firstName = 'shared-name.njk';
    const firstPath = join(firstDir, firstName);
    const secondPath = join(secondDir, firstName);
    await writeFile(firstPath, 'from first');
    await writeFile(secondPath, 'from second');
    const memo = createSourceMemo();
    const firstSource = makeSource('from first', firstPath);
    const secondSource = makeSource('from second', secondPath);
    await memo.remember(firstPath, firstSource, await stat(firstPath));
    await memo.remember(secondPath, secondSource, await stat(secondPath));

    const firstWins = await memo.consult([firstDir, secondDir], firstName);
    expect(firstWins !== null && isOk(firstWins)).toBe(true);
    if (firstWins !== null && isOk(firstWins)) {
      expect(firstWins.value).toBe(firstSource);
    }

    const reordered = await memo.consult([secondDir, firstDir], firstName);
    expect(reordered !== null && isOk(reordered)).toBe(true);
    if (reordered !== null && isOk(reordered)) {
      expect(reordered.value).toBe(secondSource);
    }
  });

  test('a file created later at a higher-precedence search path displaces an older memo entry', async () => {
    const firstDir = await makeDir();
    const secondDir = await makeDir();
    const name = 'precedence.njk';
    const secondPath = join(secondDir, name);
    await writeFile(secondPath, 'from second');
    const memo = createSourceMemo();
    await rememberFile(memo, secondPath, 'from second');

    // WHY: the file appears at the higher-precedence path only AFTER the memo entry
    // was keyed at the lower-precedence one — consult must miss (not serve the stale
    // second-path entry) so full resolution can honor search-path precedence.
    const firstPath = join(firstDir, name);
    await writeFile(firstPath, 'from first');
    expect(await memo.consult([firstDir, secondDir], name)).toBeNull();
  });

  test('an ENOENT at an earlier search path falls through to a memo hit at a later one', async () => {
    const firstDir = await makeDir();
    const secondDir = await makeDir();
    const name = 'fallthrough.njk';
    const firstPath = join(firstDir, name);
    const secondPath = join(secondDir, name);
    await writeFile(firstPath, 'from first');
    await writeFile(secondPath, 'from second');
    const memo = createSourceMemo();
    const secondSource = makeSource('from second', secondPath);
    await memo.remember(secondPath, secondSource, await stat(secondPath));

    await unlink(firstPath);
    const hit = await memo.consult([firstDir, secondDir], name);
    expect(hit !== null && isOk(hit)).toBe(true);
    if (hit !== null && isOk(hit)) {
      expect(hit.value).toBe(secondSource);
    }
  });
});

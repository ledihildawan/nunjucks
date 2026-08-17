import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isOk } from '@nunjucks/lib';
import { createSourceMemo } from './source-memo.ts';
import type { TemplateLoaderSource } from './loader-chain.ts';

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
    await memo.remember(fullPath, source);

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
    await memo.remember(fullPath, makeSource('short', fullPath));

    await writeFile(fullPath, 'noticeably longer content');
    expect(await memo.consult([dir], 'resized.njk')).toBeNull();
  });

  test('an mtime change busts the memo even when the size is identical', async () => {
    const dir = await makeDir();
    const fullPath = join(dir, 'touched.njk');
    await writeFile(fullPath, 'same size');
    const memo = createSourceMemo();
    await memo.remember(fullPath, makeSource('same size', fullPath));

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
    await memo.remember(fullPath, makeSource('vanishing', fullPath));

    await unlink(fullPath);
    expect(await memo.consult([dir], 'doomed.njk')).toBeNull();
  });

  test('remember is best-effort: a vanished file never throws and stores nothing', async () => {
    const dir = await makeDir();
    const ghostPath = join(dir, 'ghost.njk');
    const memo = createSourceMemo();

    await expect(memo.remember(ghostPath, makeSource('never', ghostPath))).resolves.toBeUndefined();
    expect(await memo.consult([dir], 'ghost.njk')).toBeNull();
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
    await memo.remember(firstPath, firstSource);
    await memo.remember(secondPath, secondSource);

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
});

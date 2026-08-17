import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findContextKeyPosition } from './find-context-key-position.ts';

describe('findContextKeyPosition', () => {
  test('prefers the prop-key occurrence over the nearer template-expression occurrence', async () => {
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'njk-ctx-key-'));
    const sourcePath = path.join(sourceDir, 'caller.ts');
    // WHY: the bare-name pass alone would match line 1 (distance 0); only the
    // `${keyName}:` pass points at line 2 — asserting line 2 pins the preference order.
    await writeFile(
      sourcePath,
      "const html = await render('{{ user.global }}', ctx);\nconst ctx = { global: process };\n"
    );
    try {
      const pos = await findContextKeyPosition({
        sourceFile: sourcePath,
        callLine: 1,
        dangerousPath: 'user.global',
      });
      expect(pos).toEqual({ line: 2, col: 15 });
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  test('falls back to a bare-name match when no prop-key occurrence exists', async () => {
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'njk-ctx-key-'));
    const sourcePath = path.join(sourceDir, 'caller.ts');
    const content = "const html = await render('{{ user.global }}', ctx);\n";
    await writeFile(sourcePath, content);
    try {
      const pos = await findContextKeyPosition({
        sourceFile: sourcePath,
        callLine: 1,
        dangerousPath: 'user.global',
      });
      expect(pos).toEqual({ line: 1, col: content.indexOf('global') + 1 });
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  test('returns null when every occurrence lies outside the ±5-line radius', async () => {
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'njk-ctx-key-'));
    const sourcePath = path.join(sourceDir, 'caller.ts');
    await writeFile(
      sourcePath,
      'const ctx = { global: process };\np\np\np\np\np\np\np\nconst html = await render(t, ctx);\n'
    );
    try {
      expect(
        await findContextKeyPosition({ sourceFile: sourcePath, callLine: 9, dangerousPath: 'user.global' })
      ).toBeNull();
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  test('returns null for an unreadable source (enrichment never throws)', async () => {
    await expect(
      findContextKeyPosition({
        sourceFile: path.join(tmpdir(), 'njk-missing-ctx-source.ts'),
        callLine: 1,
        dangerousPath: 'user.global',
      })
    ).resolves.toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readProjectSource } from './project-source-reader.ts';

describe('readProjectSource', () => {
  test('returns null when the frame has no line number', () => {
    expect(readProjectSource({ path: '/anywhere/source.ts', line: null, col: null })).toBeNull();
  });

  test('returns null for node_modules paths', () => {
    expect(
      readProjectSource({ path: '/project/node_modules/pkg/index.ts', line: 3, col: 1 })
    ).toBeNull();
  });

  test('returns null for an unreadable file', () => {
    expect(
      readProjectSource({ path: path.join(tmpdir(), 'njk-missing-source.ts'), line: 3, col: 1 })
    ).toBeNull();
  });

  test('reads real project source content with location metadata', async () => {
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'njk-project-source-'));
    const sourcePath = path.join(sourceDir, 'caller.ts');
    await writeFile(sourcePath, 'const template = "{{ greeting }}";\n');
    try {
      const content = readProjectSource({ path: sourcePath, line: 1, col: 12 });
      expect(content).not.toBeNull();
      expect(content?.templatePath).toBe(sourcePath);
      expect(content?.lineno).toBe(1);
      expect(content?.colno).toBe(12);
      expect(content?.sourceContent).toContain('{{ greeting }}');
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });
});

import { describe, test, expect } from 'bun:test';
import { isFilePath, resolveIdeLink, getIdeMeta } from './ide-links.ts';
import type { IdeLinkFn, LinkTarget } from './ide-links.ts';

describe('isFilePath', () => {
  const detectedCases: ReadonlyArray<{ label: string; path: string }> = [
    { label: 'a nunjucks template', path: 'template.njk' },
    { label: 'a typescript file', path: 'app.ts' },
    { label: 'a json file', path: 'package.json' },
    { label: 'a markdown file', path: 'README.md' },
    { label: 'a nested posix path', path: '/usr/local/src/view.njk' },
    { label: 'a windows drive path', path: 'C:\\src\\template.njk' },
  ];

  detectedCases.forEach(({ label, path }) => {
    test(`detects ${label} as a file path`, () => {
      expect(isFilePath(path)).toBe(true);
    });
  });

  const rejectedCases: ReadonlyArray<{ label: string; path: string | null | undefined }> = [
    { label: 'an unknown extension', path: 'archive.zip' },
    { label: 'a path with no extension', path: 'Makefile' },
    { label: 'a native marker', path: 'native' },
    { label: 'an angle-bracket anonymous frame', path: '<anonymous>' },
    { label: 'a non-file url without an extension', path: 'https://example.com/page' },
    { label: 'an empty string', path: '' },
    { label: 'a whitespace-only string', path: '   ' },
    { label: 'null', path: null },
    { label: 'undefined', path: undefined },
  ];

  rejectedCases.forEach(({ label, path }) => {
    test(`rejects ${label}`, () => {
      expect(isFilePath(path)).toBe(false);
    });
  });
});

describe('resolveIdeLink', () => {
  test('builds a vscode:// link for the vscode ide, normalising the drive path', () => {
    const target: LinkTarget = { path: 'C:\\src\\app.ts', line: 10, col: 20 };
    expect(resolveIdeLink('vscode', target)).toBe('vscode://file/C:/src/app.ts:10:20');
  });

  test('converts backslashes to forward slashes for vscode links', () => {
    expect(resolveIdeLink('vscode', { path: 'C:\\a\\b\\c.ts', line: 1, col: 2 })).toBe(
      'vscode://file/C:/a/b/c.ts:1:2',
    );
  });

  test('strips a file:// prefix for vscode links', () => {
    expect(resolveIdeLink('vscode', { path: 'file:///C:/src/app.ts', line: 3, col: 4 })).toBe(
      'vscode://file/C:/src/app.ts:3:4',
    );
  });

  test('builds a custom navto: link without normalising the path', () => {
    const customPath = 'C:\\src\\app.ts';
    const link = resolveIdeLink('custom', { path: customPath, line: 5, col: 6 });
    expect(link).toBe(`navto:nunjucks?path=${encodeURIComponent(customPath)}&line=5&col=6`);
  });

  test('uses a custom ide link builder function', () => {
    const builder: IdeLinkFn = (path, line, col) => `webstorm://open?file=${path}&line=${line}&col=${col}`;
    expect(resolveIdeLink(builder, { path: 'src/app.ts', line: 7, col: 8 })).toBe(
      'webstorm://open?file=src/app.ts&line=7&col=8',
    );
  });

  test('passes path, line and col to the custom builder untouched', () => {
    const builder: IdeLinkFn = (path, line, col) => `${path}|${line}|${col}`;
    expect(resolveIdeLink(builder, { path: 'a.b', line: 1, col: 2 })).toBe('a.b|1|2');
  });

  test('falls back to vscode:// for any unrecognised ide string', () => {
    expect(resolveIdeLink('webstorm', { path: 'app.ts', line: 1, col: 1 })).toBe('vscode://file/app.ts:1:1');
  });
});

describe('getIdeMeta', () => {
  test('returns the VS Code label and brand color for the vscode ide', () => {
    const meta = getIdeMeta('vscode');
    expect(meta.label).toBe('VSCode');
    expect(meta.color).toBe('#007ACC');
  });

  test('includes an svg path icon using currentColor', () => {
    const icon = getIdeMeta('vscode').icon;
    expect(icon).toContain('currentColor');
    expect(icon).toContain('<path');
  });

  test('returns the same VS Code meta regardless of the ide argument', () => {
    const builder: IdeLinkFn = () => '';
    expect(getIdeMeta('custom')).toEqual(getIdeMeta('vscode'));
    expect(getIdeMeta(builder)).toEqual(getIdeMeta('vscode'));
  });
});

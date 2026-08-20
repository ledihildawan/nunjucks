import { describe, expect, test } from 'bun:test';
import type { IdeLinkFn, LinkTarget } from './ide-links.ts';
import { getIdeMeta, isFilePath, resolveIdeLink } from './ide-links.ts';

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
  test('builds a vscode:// link for the vscode ide, normalising and encoding the drive path', () => {
    const target: LinkTarget = { path: 'C:\\src\\app.ts', line: 10, col: 20 };
    expect(resolveIdeLink('vscode', target)).toBe('vscode://file/C%3A/src/app.ts:10:20');
  });

  test('converts backslashes to forward slashes for vscode links', () => {
    expect(resolveIdeLink('vscode', { path: 'C:\\a\\b\\c.ts', line: 1, col: 2 })).toBe(
      'vscode://file/C%3A/a/b/c.ts:1:2'
    );
  });

  test('strips a file:// prefix for vscode links', () => {
    expect(resolveIdeLink('vscode', { path: 'file:///C:/src/app.ts', line: 3, col: 4 })).toBe(
      'vscode://file/C%3A/src/app.ts:3:4'
    );
  });

  test('builds cursor link using vscode scheme', () => {
    expect(resolveIdeLink('cursor', { path: 'app.ts', line: 1, col: 2 })).toBe(
      'vscode://file/app.ts:1:2'
    );
  });

  test('builds zed:// link for zed', () => {
    expect(resolveIdeLink('zed', { path: 'app.ts', line: 5, col: 10 })).toBe(
      'zed://open?file=app.ts&line=5&col=10'
    );
  });

  test('builds textmate txmt:// link', () => {
    expect(resolveIdeLink('textmate', { path: 'app.ts', line: 3, col: 7 })).toBe(
      'txmt://open?url=file://app.ts&line=3&column=7'
    );
  });

  test('builds bbedit:// link', () => {
    expect(resolveIdeLink('bbedit', { path: 'app.ts', line: 4, col: 8 })).toBe(
      'bbedit://app.ts?line=4'
    );
  });

  test('builds sublime link with subl scheme', () => {
    expect(resolveIdeLink('sublime', { path: 'app.ts', line: 2, col: 5 })).toBe(
      'subl://open?url=file://app.ts&line=2'
    );
  });

  test('returns jetbrains documentation URL for jetbrains family', () => {
    expect(resolveIdeLink('jetbrains', { path: 'app.ts', line: 1, col: 1 })).toBe(
      'https://www.jetbrains.com/idea/guide/tips/open-in-ide/'
    );
    expect(resolveIdeLink('intellij', { path: 'app.ts', line: 1, col: 1 })).toBe(
      'https://www.jetbrains.com/idea/guide/tips/open-in-ide/'
    );
    expect(resolveIdeLink('pycharm', { path: 'app.ts', line: 1, col: 1 })).toBe(
      'https://www.jetbrains.com/idea/guide/tips/open-in-ide/'
    );
    expect(resolveIdeLink('webstorm', { path: 'app.ts', line: 1, col: 1 })).toBe(
      'https://www.jetbrains.com/idea/guide/tips/open-in-ide/'
    );
  });

  test('builds a custom navto: link without normalising the path', () => {
    const customPath = 'C:\\src\\app.ts';
    const link = resolveIdeLink('custom', { path: customPath, line: 5, col: 6 });
    expect(link).toBe(`navto:nunjucks?path=${encodeURIComponent(customPath)}&line=5&col=6`);
  });

  test('uses a custom ide link builder function', () => {
    const builder: IdeLinkFn = (path, line, col) =>
      `custom://open?file=${path}&line=${line}&col=${col}`;
    expect(resolveIdeLink(builder, { path: 'src/app.ts', line: 7, col: 8 })).toBe(
      'custom://open?file=src/app.ts&line=7&col=8'
    );
  });

  test('passes path, line and col to the custom builder untouched', () => {
    const builder: IdeLinkFn = (path, line, col) => `${path}|${line}|${col}`;
    expect(resolveIdeLink(builder, { path: 'a.b', line: 1, col: 2 })).toBe('a.b|1|2');
  });

  test('falls back to vscode:// for any unrecognised ide string', () => {
    expect(resolveIdeLink('nonexistent-ide', { path: 'app.ts', line: 1, col: 1 })).toBe(
      'vscode://file/app.ts:1:1'
    );
  });

  test('percent-encodes spaces, ? and # in scheme paths while keeping slashes', () => {
    const target: LinkTarget = { path: 'proj/my file?q=1/a#b.njk', line: 5, col: 2 };
    expect(resolveIdeLink('vscode', target)).toBe(
      'vscode://file/proj/my%20file%3Fq%3D1/a%23b.njk:5:2'
    );
    expect(resolveIdeLink('cursor', target)).toBe(
      'vscode://file/proj/my%20file%3Fq%3D1/a%23b.njk:5:2'
    );
    expect(resolveIdeLink('vscodium', target)).toBe(
      'vscodium://file/proj/my%20file%3Fq%3D1/a%23b.njk:5:2'
    );
    expect(resolveIdeLink('nonexistent-ide', target)).toBe(
      'vscode://file/proj/my%20file%3Fq%3D1/a%23b.njk:5:2'
    );
    expect(resolveIdeLink('bbedit', { path: '/tmp/my file#1.njk', line: 4, col: 8 })).toBe(
      'bbedit:///tmp/my%20file%231.njk?line=4'
    );
  });
});

describe('getIdeMeta', () => {
  test('returns VS Code metadata by default', () => {
    const meta = getIdeMeta();
    expect(meta.label).toBe('VS Code');
    expect(meta.color).toBe('#007ACC');
  });

  test('returns VS Code metadata for unknown IDE', () => {
    const meta = getIdeMeta('unknown');
    expect(meta.label).toBe('VS Code');
    expect(meta.color).toBe('#007ACC');
  });

  test('returns Cursor metadata for cursor', () => {
    const meta = getIdeMeta('cursor');
    expect(meta.label).toBe('Cursor');
    expect(meta.color).toBe('#000000');
  });

  test('returns WebStorm metadata for webstorm', () => {
    const meta = getIdeMeta('webstorm');
    expect(meta.label).toBe('WebStorm');
    expect(meta.color).toBe('#000000');
  });

  test('returns PyCharm metadata for pycharm', () => {
    const meta = getIdeMeta('pycharm');
    expect(meta.label).toBe('PyCharm');
    expect(meta.color).toBe('#000000');
  });

  test('returns JetBrains metadata for jetbrains family', () => {
    const jetbrainsMeta = getIdeMeta('jetbrains');
    expect(jetbrainsMeta.label).toBe('JetBrains');
    expect(jetbrainsMeta.color).toBe('#000000');

    expect(getIdeMeta('intellij').label).toBe('JetBrains');
    expect(getIdeMeta('goland').label).toBe('JetBrains');
    expect(getIdeMeta('rider').label).toBe('JetBrains');
  });

  test('returns Zed metadata for zed', () => {
    const meta = getIdeMeta('zed');
    expect(meta.label).toBe('Zed');
    expect(meta.color).toBe('#000000');
  });

  test('returns Sublime Text metadata for sublime', () => {
    const meta = getIdeMeta('sublime');
    expect(meta.label).toBe('Sublime Text');
    expect(meta.color).toBe('#FF9800');
  });

  test('returns TextMate metadata for textmate', () => {
    const meta = getIdeMeta('textmate');
    expect(meta.label).toBe('TextMate');
    expect(meta.color).toBe('#000000');
  });

  test('returns VSCodium metadata for vscodium', () => {
    const meta = getIdeMeta('vscodium');
    expect(meta.label).toBe('VSCodium');
    expect(meta.color).toBe('#2F80ED');
  });

  test('returns BBEdit metadata for bbedit', () => {
    const meta = getIdeMeta('bbedit');
    expect(meta.label).toBe('BBEdit');
    expect(meta.color).toBe('#000000');
  });

  test('includes an svg icon using currentColor', () => {
    const icon = getIdeMeta('vscode').icon;
    expect(icon).toContain('currentColor');
    expect(icon).toContain('<svg');
  });
});

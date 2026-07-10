import { describe, test, expect } from 'bun:test';
import { IDE_SCHEMES, resolveIdeLink, getIdeMeta } from './ide-links.js';

describe('IDE_SCHEMES', () => {
  const knownIdes = ['vscode', 'cursor', 'windsurf', 'zed', 'webstorm', 'intellij', 'phpstorm', 'pycharm', 'sublime'];

  test.each(knownIdes)('%s has label, color, link, icon', (ide) => {
    const scheme = IDE_SCHEMES[ide];
    expect(scheme).toHaveProperty('label');
    expect(scheme).toHaveProperty('color');
    expect(scheme).toHaveProperty('link');
    expect(typeof scheme.link).toBe('function');
    expect(scheme).toHaveProperty('icon');
  });

  test('vscode generates correct link', () => {
    const link = IDE_SCHEMES.vscode.link('/path/file.js', 10, 5);
    expect(link).toMatch(/^vscode:\/\/file\/.+/);
  });
});

describe('resolveIdeLink', () => {
  test('uses vscode as default for unknown IDE', () => {
    const link = resolveIdeLink('unknown', '/path/file.js', 10, 5);
    expect(link).toMatch(/^vscode:\/\/file\//);
  });

  test('resolves vscode link', () => {
    const link = resolveIdeLink('vscode', '/path/file.js', 10, 5);
    expect(link).toMatch(/^vscode:\/\/file\/.+\/file\.js:10:5$/);
  });

  test('resolves cursor link', () => {
    const link = resolveIdeLink('cursor', '/path/file.js', 3, 1);
    expect(link).toMatch(/^cursor:\/\/file\//);
  });

  test('resolves custom function', () => {
    const custom = (p, l, c) => `custom://${p}:${l}:${c}`;
    const link = resolveIdeLink(custom, '/f.js', 1, 0);
    expect(link).toBe('custom:///f.js:1:0');
  });

  test('normalizes path in link', () => {
    const link = resolveIdeLink('vscode', 'C:\\path\\file.js', 1, 0);
    expect(link).toContain('C:/path/file.js');
  });
});

describe('getIdeMeta', () => {
  test('returns vscode meta for unknown IDE', () => {
    const meta = getIdeMeta('unknown');
    expect(meta.label).toBe('VS Code');
  });

  test('returns cursor meta', () => {
    const meta = getIdeMeta('cursor');
    expect(meta.label).toBe('Cursor');
    expect(meta.color).toBe('#00A1F1');
  });

  test('returns default meta for custom function', () => {
    const meta = getIdeMeta(() => {});
    expect(meta.label).toBe('IDE');
    expect(meta.color).toBeNull();
  });
});

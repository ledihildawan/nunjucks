import { expect, describe, test } from 'bun:test';
import { normalizeDrivePath, shortenPath } from './path-shortener.js';

describe('normalizeDrivePath', () => {
  test('strips leading slashes before drive letter', () => {
    expect(normalizeDrivePath('//C:/foo')).toBe('C:/foo');
    expect(normalizeDrivePath('\\C:\\foo')).toBe('C:/foo');
    expect(normalizeDrivePath('\\\\C:\\bar')).toBe('C:/bar');
  });

  test('replaces backslashes with forward slashes', () => {
    expect(normalizeDrivePath('C:\\Users\\test')).toBe('C:/Users/test');
  });

  test('leaves already normalized path unchanged', () => {
    expect(normalizeDrivePath('/home/user/file.njk')).toBe('/home/user/file.njk');
  });
});

describe('shortenPath', () => {
  test('shortens path containing /Users/ segment with project root', () => {
    const cwd = process.cwd().replace(/\\/g, '/');
    const rootDirName = cwd.split('/').pop();
    const path = `/Users/me/projects/${rootDirName}/template.njk`;
    const result = shortenPath(path);
    expect(result).toMatch(/^Users\//);
    expect(result).toContain('...');
    expect(result).toContain(rootDirName);
  });

  test('shortens path containing /home/ segment with project root', () => {
    const cwd = process.cwd().replace(/\\/g, '/');
    const rootDirName = cwd.split('/').pop();
    const path = `/home/dev/${rootDirName}/template.njk`;
    const result = shortenPath(path);
    expect(result).toMatch(/^home\//);
    expect(result).toContain('...');
  });

  test('shortens user path without project root', () => {
    const result = shortenPath('/Users/me/other/template.njk');
    expect(result).toBe('Users/.../other/template.njk');
  });

  test('returns path unchanged if no users/home segment', () => {
    const result = shortenPath('/var/www/template.njk');
    expect(result).toBe('/var/www/template.njk');
  });

  test('normalizes path before shortening', () => {
    const result = shortenPath('C:\\Users\\me\\other\\file.njk');
    expect(result).toBe('C:/Users/.../other/file.njk');
  });

  test('handles empty string', () => {
    const result = shortenPath('');
    expect(result).toBe('');
  });
});

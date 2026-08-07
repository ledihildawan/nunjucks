import { describe, test, expect } from 'bun:test';
import { normalizeDrivePath, shortenPath } from './path-shortener.ts';

describe('normalizeDrivePath', () => {
  test('strips a file:// prefix', () => {
    expect(normalizeDrivePath('file:///C:/src/app')).toBe('C:/src/app');
  });
  test('collapses leading slashes before a drive letter', () => {
    expect(normalizeDrivePath('/C:/src/app')).toBe('C:/src/app');
  });
  test('converts backslashes to forward slashes', () => {
    expect(normalizeDrivePath('C:\\src\\app\\file.ts')).toBe('C:/src/app/file.ts');
  });
  test('leaves a plain posix path unchanged', () => {
    expect(normalizeDrivePath('/var/log/app')).toBe('/var/log/app');
  });
});

describe('shortenPath', () => {
  test('collapses the middle of a path under a users directory around the project dir name', () => {
    expect(shortenPath('/Users/bob/work/app', '/Users/bob/work')).toBe('Users/.../work/app');
  });
  test('leaves paths without a users/home segment untouched', () => {
    expect(shortenPath('/var/log/app')).toBe('/var/log/app');
  });
  test('treats home as a private root segment', () => {
    expect(shortenPath('/home/bob/work/app', '/home/bob/work')).toBe('home/.../work/app');
  });
});

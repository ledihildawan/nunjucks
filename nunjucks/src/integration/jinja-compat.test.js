import { describe, test, expect } from 'bun:test';
import { createCompatInstaller } from './jinja-compat.js';

describe('createCompatInstaller', () => {
  test('returns a function', () => {
    const installer = createCompatInstaller();
    expect(typeof installer).toBe('function');
  });

  test('first call returns a function (uninstaller)', () => {
    const installer = createCompatInstaller();
    const uninstall = installer();
    expect(typeof uninstall).toBe('function');
  });

  test('second call from same installer returns a noop', () => {
    const installer = createCompatInstaller();
    installer();
    const second = installer();
    expect(typeof second).toBe('function');
  });

  test('uninstaller allows re-installation', () => {
    const installer = createCompatInstaller();
    const uninstall = installer();

    uninstall();

    const reinstall = installer();
    expect(typeof reinstall).toBe('function');
  });

  test('different installers are independent', () => {
    const a = createCompatInstaller();
    const b = createCompatInstaller();

    const unA = a();
    const unB = b();

    expect(typeof unA).toBe('function');
    expect(typeof unB).toBe('function');

    unA();

    const reA = a();
    expect(typeof reA).toBe('function');

    const secondB = b();
    expect(typeof secondB).toBe('function');
    expect(secondB()).toBeUndefined();
  });
});

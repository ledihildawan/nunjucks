import { expect, describe, test } from 'bun:test';
import { isDevelopment } from './environment-check.js';

describe('isDevelopment', () => {
  test('returns true when NODE_ENV is not set', () => {
    const orig = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    expect(isDevelopment()).toBe(true);
    process.env.NODE_ENV = orig;
  });

  test('returns false when NODE_ENV is production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(isDevelopment()).toBe(false);
    process.env.NODE_ENV = orig;
  });

  test('returns false when NODE_ENV is test', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    expect(isDevelopment()).toBe(false);
    process.env.NODE_ENV = orig;
  });

  test('returns true when NODE_ENV is development', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(isDevelopment()).toBe(true);
    process.env.NODE_ENV = orig;
  });

  test('returns true when NODE_ENV is any other value', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';
    expect(isDevelopment()).toBe(true);
    process.env.NODE_ENV = orig;
  });
});

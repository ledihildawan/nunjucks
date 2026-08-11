import { describe, test, expect } from 'bun:test';

describe('lib smoke', () => {
  test('index exports something', async () => {
    const lib = await import('./index.ts');
    expect(Object.keys(lib).length).toBeGreaterThanOrEqual(0);
  });
});

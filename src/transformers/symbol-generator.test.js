import { describe, test, expect } from 'bun:test';
import { createSymbolGenerator, createGensym } from './symbol-generator.js';

describe('createSymbolGenerator', () => {
  test('generates incrementing symbols starting from seed', () => {
    const gen = createSymbolGenerator(0);
    expect(gen()).toBe('hole_0');
    expect(gen()).toBe('hole_1');
    expect(gen()).toBe('hole_2');
  });

  test('defaults seed to 0', () => {
    const gen = createSymbolGenerator();
    expect(gen()).toBe('hole_0');
  });

  test('different generators have independent counters', () => {
    const genA = createSymbolGenerator(100);
    const genB = createSymbolGenerator(200);
    expect(genA()).toBe('hole_100');
    expect(genB()).toBe('hole_200');
    expect(genA()).toBe('hole_101');
  });
});

describe('createGensym', () => {
  test('generates incrementing symbols', () => {
    const gen = createGensym();
    expect(gen()).toBe('hole_0');
    expect(gen()).toBe('hole_1');
  });

  test('each call creates independent generator', () => {
    const genA = createGensym();
    const genB = createGensym();
    expect(genA()).toBe('hole_0');
    expect(genB()).toBe('hole_0');
  });
});

import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('loaders/index exports', () => {
  test('exports FileSystemLoader', () => expect(mod.FileSystemLoader).toBeFunction());
  test('exports NodeResolveLoader', () => expect(mod.NodeResolveLoader).toBeFunction());
  test('exports WebLoader', () => expect(mod.WebLoader).toBeFunction());
  test('exports PrecompiledLoader', () => expect(mod.PrecompiledLoader).toBeFunction());
  test('exports Loader', () => expect(mod.Loader).toBeFunction());
});

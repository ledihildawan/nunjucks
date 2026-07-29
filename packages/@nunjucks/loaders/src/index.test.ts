import { describe, test, expect } from 'bun:test';
import * as mod from './index.ts';

describe('loaders/index exports', () => {
  test('exports createFileSystemLoader', () => expect(mod.createFileSystemLoader).toBeFunction());
  test('exports createLoader', () => expect(mod.createLoader).toBeFunction());
});

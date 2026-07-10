import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('parser/node-parsers exports', () => {
  test('exports parseAggregate', () => expect(mod.parseAggregate).toBeFunction());
  test('exports parseSignature', () => expect(mod.parseSignature).toBeFunction());
});

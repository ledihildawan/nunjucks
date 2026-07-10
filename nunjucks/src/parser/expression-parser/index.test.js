import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('parser/expression-parser exports', () => {
  test('exports parseExpression', () => expect(mod.parseExpression).toBeFunction());
  test('exports parseInlineIf', () => expect(mod.parseInlineIf).toBeFunction());
  test('exports parseOr', () => expect(mod.parseOr).toBeFunction());
  test('exports parseAnd', () => expect(mod.parseAnd).toBeFunction());
  test('exports parseNot', () => expect(mod.parseNot).toBeFunction());
  test('exports parseNullishCoalesce', () => expect(mod.parseNullishCoalesce).toBeFunction());
  test('exports parseIn', () => expect(mod.parseIn).toBeFunction());
  test('exports parseIs', () => expect(mod.parseIs).toBeFunction());
  test('exports parseCompare', () => expect(mod.parseCompare).toBeFunction());
  test('exports parseConcat', () => expect(mod.parseConcat).toBeFunction());
  test('exports parseAdd', () => expect(mod.parseAdd).toBeFunction());
  test('exports parseSub', () => expect(mod.parseSub).toBeFunction());
  test('exports parseMul', () => expect(mod.parseMul).toBeFunction());
  test('exports parseDiv', () => expect(mod.parseDiv).toBeFunction());
  test('exports parseFloorDiv', () => expect(mod.parseFloorDiv).toBeFunction());
  test('exports parseMod', () => expect(mod.parseMod).toBeFunction());
  test('exports parsePow', () => expect(mod.parsePow).toBeFunction());
  test('exports parseUnary', () => expect(mod.parseUnary).toBeFunction());
  test('exports parsePrimary', () => expect(mod.parsePrimary).toBeFunction());
});

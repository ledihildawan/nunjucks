import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('error/constants exports', () => {
  test('exports PATTERNS', () => expect(mod.PATTERNS).toBeObject());
  test('exports ERROR_RULES', () => expect(mod.ERROR_RULES).toBeArray());
  test('exports DEFAULT_CLASSIFICATION', () => expect(mod.DEFAULT_CLASSIFICATION).toBeObject());
  test('exports IDE_SCHEMES', () => expect(mod.IDE_SCHEMES).toBeObject());
  test('exports resolveIdeLink', () => expect(mod.resolveIdeLink).toBeFunction());
  test('exports getIdeMeta', () => expect(mod.getIdeMeta).toBeFunction());
});

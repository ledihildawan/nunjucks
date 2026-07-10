import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('error/formatters/html exports', () => {
  test('exports toHtmlString', () => expect(mod.toHtmlString).toBeFunction());
  test('exports CSS', () => expect(mod.CSS).toBeString());
  test('exports PRODUCTION_BODY', () => expect(mod.PRODUCTION_BODY).toBeString());
  test('exports TOGGLE_SCRIPT', () => expect(mod.TOGGLE_SCRIPT).toBeString());
});

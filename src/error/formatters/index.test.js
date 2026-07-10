import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('error/formatters exports', () => {
  test('exports toConsoleString', () => expect(mod.toConsoleString).toBeFunction());
  test('exports toHtmlString', () => expect(mod.toHtmlString).toBeFunction());
});

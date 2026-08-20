import { describe, expect, test } from 'bun:test';
import { classifyAndBuildTitle, resolveHumanTitle } from './classify-title.ts';

// WHY: regression pin for the dead-switch bug — resolveHumanTitle used to switch on
// UPPERCASE code names while `category` is always the lowercase def category, so every
// case was unreachable. These tests go through the REAL pipeline (real catalog codes
// and message patterns) so the human titles actually fire for real classifications.
describe('classifyAndBuildTitle — real classifications reach the catalog titles', () => {
  test('reserved keyword hint fires for a reserved-keyword message', () => {
    expect(classifyAndBuildTitle({ message: "Cannot use reserved keyword 'if'" })).toBe(
      "Cannot use reserved keyword 'if'"
    );
  });

  test('undefined-output hint fires when the subject only appears in the message', () => {
    expect(
      classifyAndBuildTitle({
        code: 'UNDEFINED_VARIABLE',
        message: "attempted to output 'ctxVar'",
      })
    ).toBe("Variable 'ctxVar' is not defined");
  });

  test('FILE_NOT_FOUND title renders through the catalog template', () => {
    expect(classifyAndBuildTitle({ message: 'template not found: missing.njk' })).toBe(
      'template not found: missing.njk'
    );
  });

  test('undefined filter title interpolates the filter name', () => {
    expect(classifyAndBuildTitle({ message: "Filter 'upper' is not defined" })).toBe(
      "Filter 'upper' is not defined"
    );
  });

  test('unclassified errors fall back to the plain message', () => {
    expect(classifyAndBuildTitle({ message: 'something novel went wrong' })).toBe(
      'something novel went wrong'
    );
  });
});

describe('resolveHumanTitle — direct inputs', () => {
  test('undefined variable without a name falls back', () => {
    expect(
      resolveHumanTitle({
        name: 'UNDEFINED_VARIABLE',
        undefinedName: null,
        plain: '',
        fallback: 'F',
      })
    ).toBe('F');
  });

  test('null name (unclassified) falls back', () => {
    expect(resolveHumanTitle({ name: null, undefinedName: null, plain: 'p', fallback: 'F' })).toBe(
      'F'
    );
  });

  test('reserved keyword message without pattern capture falls back', () => {
    expect(
      resolveHumanTitle({
        name: 'RESERVED_KEYWORD',
        undefinedName: null,
        plain: 'nope',
        fallback: 'F',
      })
    ).toBe('F');
  });
});

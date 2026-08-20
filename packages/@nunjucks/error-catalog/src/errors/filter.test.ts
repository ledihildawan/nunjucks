import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';
import { FILTER_ERRORS } from './filter.ts';

describe('FILTER_ERRORS definitions', () => {
  test('each entry is keyed by its own name and carries guidance', () => {
    for (const [name, def] of Object.entries(FILTER_ERRORS)) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('message templates interpolate their declared placeholders', () => {
    expect(
      FILTER_ERRORS.UNKNOWN_FILTER_KWARG.message
        .replaceAll('{name}', 'reverse')
        .replaceAll('{accepted}', 'key, reverse')
    ).toBe("Unknown keyword argument 'reverse' (accepted: key, reverse)");
    expect(FILTER_ERRORS.LIST_FILTER.message.replaceAll('{type}', 'string')).toBe(
      'list: expected array, got string'
    );
    expect(FILTER_ERRORS.SUM_FILTER_ATTR.message.replaceAll('{attr}', 'price')).toBe(
      "sum: attribute 'price' does not exist on all items"
    );
  });
});

describe('UNKNOWN_FILTER_KWARG extraFrom', () => {
  test('maps the two capture groups to the name and accepted placeholders', () => {
    const match = [
      "Unknown keyword argument 'reverse' (accepted: key, reverse)",
      'reverse',
      'key, reverse',
    ] as unknown as RegExpMatchArray;
    expect(FILTER_ERRORS.UNKNOWN_FILTER_KWARG.extraFrom?.(match)).toStrictEqual({
      name: 'reverse',
      accepted: 'key, reverse',
    });
  });
});

describe('slice guard errors', () => {
  test('SLICE_STEP matches only its exact message', () => {
    expect(FILTER_ERRORS.SLICE_STEP.pattern.test('slice: step cannot be zero')).toBe(true);
    expect(FILTER_ERRORS.SLICE_STEP.pattern.test('slice: step cannot be zero today')).toBe(false);
    expect(classifyFromError({ message: 'slice: step cannot be zero' }).category).toBe(
      'slice_error'
    );
  });

  test('SLICE_ZERO matches only its exact message', () => {
    expect(FILTER_ERRORS.SLICE_ZERO.pattern.test('slice: number of slices must be positive')).toBe(
      true
    );
    expect(
      classifyFromError({ message: 'slice: number of slices must be positive' }).category
    ).toBe('slice_error');
  });
});

describe('array-input filter errors classify by their filter', () => {
  test('LIST_FILTER reports the iterable category', () => {
    const cls = classifyFromError({ message: 'list: expected array, got string' });
    expect(cls.category).toBe('iterable_error');
  });

  test('FIRST_LAST_FILTER and JOIN_FILTER report the array category', () => {
    expect(classifyFromError({ message: 'first/last: expected array, got null' }).category).toBe(
      'array_error'
    );
    expect(classifyFromError({ message: 'join: expected array, got object' }).category).toBe(
      'array_error'
    );
  });

  test('SUM_FILTER and SORT_FILTER report their categories', () => {
    expect(classifyFromError({ message: 'sum: expected array, got string' }).category).toBe(
      'array_error'
    );
    expect(classifyFromError({ message: 'sort: expected array, got object' }).category).toBe(
      'sort_type_error'
    );
  });

  test('attribute variants extract the attribute name', () => {
    expect(
      classifyFromError({ message: "sort: attribute 'price' does not exist on object" })
        .undefinedName
    ).toBe('price');
    expect(
      classifyFromError({ message: "groupby: attribute 'cat' does not exist on object" }).category
    ).toBe('groupby_type_error');
  });
});

describe('MATH_FILTER', () => {
  test('matches the abs/round shape and reports the math category', () => {
    expect(FILTER_ERRORS.MATH_FILTER.pattern.test('abs/round: expected number, got string')).toBe(
      true
    );
    expect(classifyFromError({ message: 'abs/round: expected number, got string' }).category).toBe(
      'math_error'
    );
  });
});

describe('FILTER_ERROR', () => {
  test('pattern recognizes every listed raw throw shape', () => {
    const { pattern } = FILTER_ERRORS.FILTER_ERROR;
    expect(pattern.test('Error: Filter upper threw')).toBe(true);
    expect(pattern.test('filter threw')).toBe(true);
    expect(pattern.test('Filter upper failed')).toBe(true);
    expect(pattern.test('Filter did something else')).toBe(false);
    // WHY: every branch is anchored — `filter threw` must not match mid-message.
    expect(pattern.test('discussed how the filter threw earlier')).toBe(false);
    expect(classifyFromError({ message: 'Error: Filter upper threw' }).category).toBe(
      'filter_error'
    );
  });
});

describe('JSON_ESCAPED_OUTPUT', () => {
  test('recognizes the autoescaped-JSON warning shape', () => {
    expect(
      classifyFromError({ message: 'JSON output is HTML-escaped when autoescape is enabled' })
        .category
    ).toBe('json_error');
  });
});

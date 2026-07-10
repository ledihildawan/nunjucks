import { describe, test, expect } from 'bun:test';
import {
  callable, defined, divisibleby, escaped, equalto, eq, sameas,
  even, falsy, ge, greaterthan, gt, le, lessthan, lt,
  isLowerCase, ne, nullTest, number, odd,
  isString, truthy, undefinedTest,
  isUpperCase, iterable, mapping,
} from './built-in-tests.js';
import { createSafeString } from '../runtime/index.js';

describe('callable', () => {
  test('returns true for functions', () => {
    expect(callable(() => {})).toBe(true);
    expect(callable(function () {})).toBe(true);
  });

  test('returns false for non-functions', () => {
    expect(callable(42)).toBe(false);
    expect(callable('str')).toBe(false);
  });
});

describe('defined', () => {
  test('returns false for undefined', () => {
    expect(defined(undefined)).toBe(false);
  });

  test('returns true for null and other values', () => {
    expect(defined(null)).toBe(true);
    expect(defined(0)).toBe(true);
    expect(defined('')).toBe(true);
  });
});

describe('divisibleby', () => {
  test('returns true when divisible', () => {
    expect(divisibleby(10, 5)).toBe(true);
    expect(divisibleby(9, 3)).toBe(true);
  });

  test('returns false when not divisible', () => {
    expect(divisibleby(10, 3)).toBe(false);
  });
});

describe('escaped', () => {
  test('returns true for SafeString', () => {
    expect(escaped(createSafeString('hello'))).toBe(true);
  });

  test('returns false for plain string', () => {
    expect(escaped('hello')).toBe(false);
  });
});

describe('equalto / eq / sameas', () => {
  test('equalto returns true for identical values', () => {
    expect(equalto(42, 42)).toBe(true);
  });

  test('eq is alias for equalto', () => {
    expect(eq).toBe(equalto);
  });

  test('sameas is alias for equalto', () => {
    expect(sameas).toBe(equalto);
  });

  test('equalto returns false for different values', () => {
    expect(equalto(1, 2)).toBe(false);
  });
});

describe('even', () => {
  test('returns true for even numbers', () => {
    expect(even(2)).toBe(true);
    expect(even(0)).toBe(true);
  });

  test('returns false for odd numbers', () => {
    expect(even(3)).toBe(false);
  });
});

describe('falsy', () => {
  test('returns true for falsy values', () => {
    expect(falsy(false)).toBe(true);
    expect(falsy(0)).toBe(true);
    expect(falsy('')).toBe(true);
    expect(falsy(null)).toBe(true);
    expect(falsy(undefined)).toBe(true);
  });

  test('returns false for truthy values', () => {
    expect(falsy(true)).toBe(false);
    expect(falsy(1)).toBe(false);
  });
});

describe('ge / greaterthan / gt', () => {
  test('ge returns true for >=', () => {
    expect(ge(5, 3)).toBe(true);
    expect(ge(3, 3)).toBe(true);
    expect(ge(2, 3)).toBe(false);
  });

  test('greaterthan returns true for >', () => {
    expect(greaterthan(5, 3)).toBe(true);
    expect(greaterthan(3, 3)).toBe(false);
  });

  test('gt is alias for greaterthan', () => {
    expect(gt).toBe(greaterthan);
  });
});

describe('le / lessthan / lt', () => {
  test('le returns true for <=', () => {
    expect(le(3, 5)).toBe(true);
    expect(le(3, 3)).toBe(true);
    expect(le(3, 2)).toBe(false);
  });

  test('lessthan returns true for <', () => {
    expect(lessthan(3, 5)).toBe(true);
    expect(lessthan(3, 3)).toBe(false);
  });

  test('lt is alias for lessthan', () => {
    expect(lt).toBe(lessthan);
  });
});

describe('isLowerCase', () => {
  test('returns true for lowercase strings', () => {
    expect(isLowerCase('hello')).toBe(true);
  });

  test('returns false for mixed case', () => {
    expect(isLowerCase('Hello')).toBe(false);
  });
});

describe('ne', () => {
  test('returns true for different values', () => {
    expect(ne(1, 2)).toBe(true);
  });

  test('returns false for equal values', () => {
    expect(ne(1, 1)).toBe(false);
  });
});

describe('null test', () => {
  test('nullTest returns true for null', () => {
    expect(nullTest(null)).toBe(true);
  });

  test('nullTest returns false for undefined', () => {
    expect(nullTest(undefined)).toBe(false);
  });

  test('nullTest returns true for null', () => {
    expect(nullTest(null)).toBe(true);
  });
});

describe('number', () => {
  test('returns true for numbers', () => {
    expect(number(42)).toBe(true);
    expect(number(NaN)).toBe(true);
  });

  test('returns false for non-numbers', () => {
    expect(number('str')).toBe(false);
  });
});

describe('odd', () => {
  test('returns true for odd numbers', () => {
    expect(odd(3)).toBe(true);
    expect(odd(1)).toBe(true);
  });

  test('returns false for even numbers', () => {
    expect(odd(2)).toBe(false);
  });
});

describe('isString', () => {
  test('returns true for strings', () => {
    expect(isString('hello')).toBe(true);
  });

  test('returns false for non-strings', () => {
    expect(isString(42)).toBe(false);
    expect(isString(null)).toBe(false);
  });
});

describe('truthy', () => {
  test('returns true for truthy values', () => {
    expect(truthy(true)).toBe(true);
    expect(truthy(1)).toBe(true);
    expect(truthy('a')).toBe(true);
  });

  test('returns false for falsy values', () => {
    expect(truthy(false)).toBe(false);
    expect(truthy(0)).toBe(false);
  });
});

describe('undefined test', () => {
  test('undefinedTest returns true for undefined', () => {
    expect(undefinedTest(undefined)).toBe(true);
  });

  test('undefinedTest returns false for null', () => {
    expect(undefinedTest(null)).toBe(false);
  });

  test('undefinedTest returns true for undefined', () => {
    expect(undefinedTest(undefined)).toBe(true);
  });
});

describe('isUpperCase', () => {
  test('returns true for uppercase strings', () => {
    expect(isUpperCase('HELLO')).toBe(true);
  });

  test('returns false for mixed case', () => {
    expect(isUpperCase('Hello')).toBe(false);
  });
});

describe('iterable', () => {
  test('returns true for arrays', () => {
    expect(iterable([1, 2, 3])).toBe(true);
  });

  test('returns true for strings', () => {
    expect(iterable('hello')).toBe(true);
  });

  test('returns false for plain objects', () => {
    expect(iterable({ a: 1 })).toBe(false);
  });

  test('returns false for numbers', () => {
    expect(iterable(42)).toBe(false);
  });
});

describe('mapping', () => {
  test('returns true for plain objects', () => {
    expect(mapping({ a: 1 })).toBe(true);
  });

  test('returns false for arrays', () => {
    expect(mapping([1, 2, 3])).toBe(false);
  });

  test('returns false for null', () => {
    expect(mapping(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(mapping(undefined)).toBe(false);
  });

  test('returns false for numbers', () => {
    expect(mapping(42)).toBe(false);
  });

  test('returns false for strings', () => {
    expect(mapping('str')).toBe(false);
  });
});

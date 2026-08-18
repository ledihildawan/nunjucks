import { describe, expect, test } from 'bun:test';
import { classifyFromError } from '../classify.ts';
import type { ErrorDefinition } from '../types.ts';
import {
  IN_OPERATOR,
  INVALID_LOOKUP,
  KEY_NOT_FOUND,
  NULL_VALUE,
  RANGE_EXCEEDED,
  UNDEFINED_PROPERTY,
  UNDEFINED_VALUE,
  UNDEFINED_VALUE_MATCH,
  UNDEFINED_VARIABLE,
} from './value-errors.ts';

const defs: readonly [string, ErrorDefinition][] = [
  ['NULL_VALUE', NULL_VALUE],
  ['UNDEFINED_VARIABLE', UNDEFINED_VARIABLE],
  ['UNDEFINED_PROPERTY', UNDEFINED_PROPERTY],
  ['UNDEFINED_VALUE', UNDEFINED_VALUE],
  ['UNDEFINED_VALUE_MATCH', UNDEFINED_VALUE_MATCH],
  ['KEY_NOT_FOUND', KEY_NOT_FOUND],
  ['RANGE_EXCEEDED', RANGE_EXCEEDED],
  ['INVALID_LOOKUP', INVALID_LOOKUP],
  ['IN_OPERATOR', IN_OPERATOR],
];

describe('value error definitions', () => {
  test('each def is keyed by its own name and carries guidance', () => {
    for (const [name, def] of defs) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });
});

describe('NULL_VALUE', () => {
  test('pattern captures accessPath, state, and parent', () => {
    const match = "Cannot access 'name' on null 'user'".match(NULL_VALUE.pattern);
    expect(match?.[1]).toBe('name');
    expect(match?.[2]).toBe('null');
    expect(match?.[3]).toBe('user');
    expect(NULL_VALUE.pattern.test("Cannot access 'name' on maybe 'user'")).toBe(false);
  });

  test('extraFrom maps capture groups to the message placeholders', () => {
    const match = "Cannot access 'address.city' on undefined 'company'".match(
      NULL_VALUE.pattern
    ) as RegExpMatchArray;
    expect(NULL_VALUE.extraFrom?.(match)).toStrictEqual({
      accessPath: 'address.city',
      state: 'undefined',
      parent: 'company',
    });
  });

  test('classification interpolates parent and accessPath into guidance', () => {
    const cls = classifyFromError({ message: "Cannot access 'name' on null 'user'" });
    expect(cls.category).toBe('null_value');
    expect(cls.undefinedName).toBe('name');
    expect(cls.title).toBe("Cannot access 'name'");
    expect(cls.causes.some((c) => c.includes('`user`'))).toBe(true);
    expect(cls.fixCode).toContain('user?.name');
  });
});

describe('UNDEFINED_PROPERTY', () => {
  test('extraFrom maps captures to the property and parent placeholders', () => {
    const match = "Property 'something' not found in 'user'".match(
      UNDEFINED_PROPERTY.pattern
    ) as RegExpMatchArray;
    expect(UNDEFINED_PROPERTY.extraFrom?.(match)).toStrictEqual({
      property: 'something',
      parent: 'user',
    });
  });

  test('classification interpolates property and parent into causes and fixCode', () => {
    const cls = classifyFromError({ message: "Property 'age' not found in 'person'" });
    expect(cls.category).toBe('undefined_property');
    expect(cls.undefinedName).toBe('age');
    expect(cls.causes.some((c) => c.includes('`age`'))).toBe(true);
    expect(cls.fixCode).toContain('person?.age');
  });
});

describe('UNDEFINED_VARIABLE', () => {
  test('pattern captures the variable name only from the full message', () => {
    expect(UNDEFINED_VARIABLE.pattern.test("Variable 'foo' is not defined")).toBe(true);
    expect(UNDEFINED_VARIABLE.pattern.test('Variable is not defined')).toBe(false);
  });

  test('classification substitutes the variable into fixCode', () => {
    const cls = classifyFromError({ message: "Variable 'foo' is not defined" });
    expect(cls.category).toBe('undefined_variable');
    expect(cls.fixCode).toContain('foo');
    expect(cls.fixCode).not.toContain('{subject}');
  });
});

describe('IN_OPERATOR', () => {
  test('subjectFrom composes the searchable key and the searched type', () => {
    const match = "Cannot use 'in' operator to search for 'a' in 5".match(
      IN_OPERATOR.pattern
    ) as RegExpMatchArray;
    expect(IN_OPERATOR.subjectFrom?.(match)).toBe('a in 5');
  });

  test('classification reports the operator category', () => {
    expect(
      classifyFromError({ message: "Cannot use 'in' operator to search for 'a' in 5" }).category
    ).toBe('operator_error');
  });
});

describe('INVALID_LOOKUP', () => {
  test('pattern recognizes dot and optional-chain markers', () => {
    const { pattern } = INVALID_LOOKUP;
    expect(pattern.test('expected name as lookup value after dot on obj, got 1')).toBe(true);
    expect(pattern.test('expected name as lookup value after ?. on obj, got end of file')).toBe(
      true
    );
    expect(pattern.test('expected name as lookup value after colon on obj, got 1')).toBe(false);
  });
});

describe('RANGE_EXCEEDED', () => {
  test('classification carries the range category for realistic throw shapes', () => {
    expect(classifyFromError({ message: 'range: 1.5..3 is not an integer' }).category).toBe(
      'range_error'
    );
  });
});

describe('UNDEFINED_VALUE_MATCH', () => {
  test('classification carries the undefined_value category', () => {
    expect(classifyFromError({ message: 'Attempted to output undefined value' }).category).toBe(
      'undefined_value'
    );
  });
});

describe('KEY_NOT_FOUND', () => {
  test('pattern captures the key name', () => {
    const match = "Key 'theme' not found".match(KEY_NOT_FOUND.pattern);
    expect(match?.[1]).toBe('theme');
    expect(classifyFromError({ message: "Key 'theme' not found" }).undefinedName).toBe('theme');
  });
});

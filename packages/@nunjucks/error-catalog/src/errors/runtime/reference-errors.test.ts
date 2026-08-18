import { describe, expect, test } from 'bun:test';
import { classifyFromError } from '../classify.ts';
import type { ErrorDefinition } from '../types.ts';
import {
  DUPLICATE_BLOCK,
  DUPLICATE_SLOT,
  NO_SUPER_BLOCK,
  RESERVED_KEYWORD,
  RESERVED_KEYWORD_CONTEXT,
  RESERVED_KEYWORD_CONTEXT_TITLE,
  UNDEFINED_BLOCK,
  UNDEFINED_EXTENSION,
  UNDEFINED_FILTER,
  UNDEFINED_FUNCTION,
  UNDEFINED_TEST,
  UNKNOWN_BLOCK_RUNTIME,
} from './reference-errors.ts';

const defs: readonly [string, ErrorDefinition][] = [
  ['UNDEFINED_FUNCTION', UNDEFINED_FUNCTION],
  ['UNDEFINED_FILTER', UNDEFINED_FILTER],
  ['UNDEFINED_TEST', UNDEFINED_TEST],
  ['UNDEFINED_BLOCK', UNDEFINED_BLOCK],
  ['UNDEFINED_EXTENSION', UNDEFINED_EXTENSION],
  ['UNKNOWN_BLOCK_RUNTIME', UNKNOWN_BLOCK_RUNTIME],
  ['DUPLICATE_BLOCK', DUPLICATE_BLOCK],
  ['DUPLICATE_SLOT', DUPLICATE_SLOT],
  ['NO_SUPER_BLOCK', NO_SUPER_BLOCK],
  ['RESERVED_KEYWORD', RESERVED_KEYWORD],
  ['RESERVED_KEYWORD_CONTEXT', RESERVED_KEYWORD_CONTEXT],
];

const resolveMessage = (def: ErrorDefinition, params: Record<string, string>): string =>
  typeof def.message === 'function'
    ? def.message(params)
    : def.message.replaceAll(/\{(\w+)\}/gu, (_, key: string) => params[key] ?? '');

describe('reference error definitions', () => {
  test('each def is keyed by its own name and carries guidance', () => {
    for (const [name, def] of defs) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('message templates interpolate their declared placeholders', () => {
    expect(resolveMessage(UNDEFINED_FUNCTION, { name: 'f' })).toBe("Function 'f' is not defined");
    expect(resolveMessage(UNDEFINED_EXTENSION, { name: 'ext' })).toBe(
      "Extension 'ext' is not registered"
    );
    expect(resolveMessage(DUPLICATE_SLOT, { name: 'header' })).toBe(
      'Slot "header" filled more than once in the same render block'
    );
    expect(resolveMessage(RESERVED_KEYWORD, { type: 'filter', name: 'if' })).toBe(
      "Cannot use reserved filter 'if'"
    );
  });
});

describe('pattern extraction', () => {
  test('UNKNOWN_BLOCK_RUNTIME captures the block name and matches the parent-less shape', () => {
    const match = 'unknown block "content"'.match(UNKNOWN_BLOCK_RUNTIME.pattern);
    expect(match?.[1]).toBe('content');
    expect(UNKNOWN_BLOCK_RUNTIME.pattern.test('parent has no block')).toBe(true);
    expect(UNKNOWN_BLOCK_RUNTIME.subjectFrom?.(match as RegExpMatchArray)).toBe('content');
  });

  test('RESERVED_KEYWORD captures type and name but defines no subject', () => {
    const match = "Cannot use reserved filter 'if'".match(RESERVED_KEYWORD.pattern);
    expect(match?.[1]).toBe('filter');
    expect(match?.[2]).toBe('if');
    expect(RESERVED_KEYWORD.subjectFrom).toBeNull();
  });

  test('NO_SUPER_BLOCK recognizes both raw throw shapes', () => {
    expect(NO_SUPER_BLOCK.pattern.test('No super block available')).toBe(true);
    expect(NO_SUPER_BLOCK.pattern.test('called super() in a block without parent')).toBe(true);
    expect(NO_SUPER_BLOCK.pattern.test('block without a parent')).toBe(false);
  });

  test('RESERVED_KEYWORD_CONTEXT pattern is unanchored and extracts no subject on its own', () => {
    expect(
      RESERVED_KEYWORD_CONTEXT.pattern.test('Cannot use reserved keyword outside its context')
    ).toBe(true);
    const match = 'reserved keyword used outside its context'.match(
      RESERVED_KEYWORD_CONTEXT.pattern
    );
    expect(RESERVED_KEYWORD_CONTEXT.subjectFrom?.(match as RegExpMatchArray)).toBeNull();
  });
});

describe('classification of reference errors', () => {
  test('UNDEFINED_FILTER substitutes the filter name into causes and fixCode', () => {
    const cls = classifyFromError({ code: 'UNDEFINED_FILTER', subject: 'upper' });
    expect(cls.category).toBe('undefined_filter');
    expect(cls.causes.some((c) => c.includes('upper'))).toBe(true);
    expect(cls.fixCode).toContain("filters: { 'upper'");
    expect(cls.fixCode).not.toContain('{subject}');
  });

  test('UNKNOWN_BLOCK_RUNTIME substitutes the extracted block name into its title', () => {
    const cls = classifyFromError({ message: 'unknown block "sidebar"' });
    expect(cls.category).toBe('undefined_block');
    expect(cls.undefinedName).toBe('sidebar');
    expect(cls.title).toContain('sidebar');
  });

  test('RESERVED_KEYWORD_CLASSIFICATION title renders from the shared title constant', () => {
    const title = RESERVED_KEYWORD_CONTEXT_TITLE.replaceAll('{subject}', 'super');
    expect(title).toBe("Cannot use reserved keyword 'super' outside of its intended context");
    expect(classifyFromError({ code: 'RESERVED_KEYWORD_CONTEXT', subject: 'super' }).title).toBe(
      title
    );
  });

  test('UNDEFINED_BLOCK captures the block name from the message', () => {
    const cls = classifyFromError({ message: 'Undefined block: content' });
    expect(cls.category).toBe('undefined_block');
    expect(cls.undefinedName).toBe('content');
  });

  test('DUPLICATE_BLOCK captures the block name from the message', () => {
    const cls = classifyFromError({ message: 'Block "header" defined more than once' });
    expect(cls.category).toBe('duplicate_block');
    expect(cls.undefinedName).toBe('header');
  });
});

import { describe, expect, test } from 'bun:test';
import { FILTER_ERRORS } from './filter.ts';
import { IO_ERRORS } from './io.ts';
import { LEXER_ERRORS } from './lexer.ts';
import { PARSER_ERRORS } from './parser.ts';
import { DEFAULT_CLASSIFICATION, ERROR_DEFINITIONS, getError, RULES, toRule } from './registry.ts';
import { RUNTIME_ERRORS } from './runtime/index.ts';
import { SANDBOX_ERRORS } from './sandbox.ts';
import { TEMPLATE_ERRORS } from './template.ts';
import type { ErrorDefinition } from './types.ts';
import { firstCapture } from './types.ts';

const GROUPS: readonly Record<string, ErrorDefinition>[] = [
  RUNTIME_ERRORS,
  PARSER_ERRORS,
  SANDBOX_ERRORS,
  IO_ERRORS,
  FILTER_ERRORS,
  TEMPLATE_ERRORS,
  LEXER_ERRORS,
];

const entries = Object.entries(ERROR_DEFINITIONS);

describe('ERROR_DEFINITIONS', () => {
  test('merges every group without cross-group name collisions', () => {
    const groupKeys = GROUPS.flatMap((group) => Object.keys(group));
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
    expect(Object.keys(ERROR_DEFINITIONS).sort()).toStrictEqual([...new Set(groupKeys)].sort());
  });

  test('every definition is keyed by its own name', () => {
    for (const [name, def] of entries) {
      expect(def.name).toBe(name);
    }
  });

  test('every definition carries a non-empty category, causes, and a pattern', () => {
    for (const def of Object.values(ERROR_DEFINITIONS)) {
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.pattern).toBeInstanceOf(RegExp);
    }
  });

  test('severity, when declared, is one of the canonical values', () => {
    const severities = new Set(['error', 'warning', 'info']);
    for (const def of Object.values(ERROR_DEFINITIONS)) {
      if (def.severity !== undefined) {
        expect(severities.has(def.severity)).toBe(true);
      }
    }
  });

  test('documentationUrl is either absent or an https URL', () => {
    for (const def of Object.values(ERROR_DEFINITIONS)) {
      if (def.documentationUrl !== undefined) {
        expect(def.documentationUrl.startsWith('https://')).toBe(true);
      }
    }
  });

  test('extraFrom output keys cover the message placeholders it must supply', () => {
    const placeholderPattern = /\{(\w+)\}/gu;
    const exercised: string[] = [];
    for (const [name, def] of entries) {
      if (typeof def.message !== 'string' || !def.extraFrom) {
        continue;
      }
      const placeholders = [
        ...new Set([...def.message.matchAll(placeholderPattern)].map((m) => m[1] ?? '')),
      ].filter((placeholder) => placeholder !== '');
      if (placeholders.length === 0) {
        continue;
      }
      const synthetic = def.message.replaceAll(placeholderPattern, 'sample');
      const match = synthetic.match(def.pattern);
      if (!match) {
        continue;
      }
      exercised.push(name);
      const extra = def.extraFrom(match);
      expect(Object.keys(extra ?? {}).sort()).toStrictEqual(placeholders.sort());
    }
    // WHY: guards the loop against silently skipping every definition — these are known to reach the assertion
    expect(exercised).toContain('UNDEFINED_PROPERTY');
    expect(exercised).toContain('BLOCKED_CONTEXT_KEYS');
  });
});

describe('getError', () => {
  test('resolves every registered code to its definition', () => {
    for (const [name] of entries) {
      expect(getError(name)?.name).toBe(name);
    }
  });

  test('returns undefined for an unregistered code', () => {
    expect(getError('NOT_A_REGISTERED_CODE')).toBeUndefined();
  });
});

describe('toRule', () => {
  test('defaults an absent subjectFrom to firstCapture', () => {
    expect(toRule(IO_ERRORS.IMPORT_ERROR).subjectFrom).toBe(firstCapture);
  });

  test('preserves an explicit subjectFrom: null', () => {
    expect(toRule(LEXER_ERRORS.UNEXPECTED_BACKTICK).subjectFrom).toBeNull();
  });

  test('preserves an explicit subjectFrom extractor', () => {
    const subjectFrom = toRule(LEXER_ERRORS.UNEXPECTED_CHAR).subjectFrom;
    expect(subjectFrom?.("'~' at line 1:2".match(/'(.+)'/u) as RegExpMatchArray)).toBe('~');
  });
});

describe('RULES', () => {
  test('compiles one rule per definition, in registry order', () => {
    expect(RULES).toHaveLength(entries.length);
    expect(RULES.map((rule) => rule.category)).toStrictEqual(
      entries.map(([, def]) => def.category)
    );
  });
});

describe('DEFAULT_CLASSIFICATION', () => {
  test('is a fully-resolved unknown classification with no null text fields', () => {
    expect(DEFAULT_CLASSIFICATION.category).toBe('unknown');
    expect(DEFAULT_CLASSIFICATION.severity).toBe('error');
    expect(DEFAULT_CLASSIFICATION.undefinedName).toBeNull();
    expect(DEFAULT_CLASSIFICATION.documentationUrl).toBeNull();
    expect(DEFAULT_CLASSIFICATION.causes.length).toBeGreaterThan(0);
    expect(typeof DEFAULT_CLASSIFICATION.fixCode).toBe('string');
    expect(typeof DEFAULT_CLASSIFICATION.fixComment).toBe('string');
  });
});

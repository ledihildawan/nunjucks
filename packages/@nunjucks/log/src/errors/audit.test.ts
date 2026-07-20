import { describe, test, expect } from 'bun:test';
import { ERROR_DEFINITIONS } from '@nunjucks/log';

const AUDIT_CONFIG = {
  minCauses: 1,
  minFixQuality: 'ok',
};

const isLowQualityFix = (fix) => {
  if (!fix) return true;
  if (typeof fix !== 'string') return true;
  const trimmed = fix.trim();
  if (trimmed.length < 5) return true;
  if (trimmed.toLowerCase().includes('this is likely')) return true;
  if (trimmed.toLowerCase().includes('check template syntax')) return true;
  if (trimmed.toLowerCase().includes('check that the')) return true;
  if (trimmed.toLowerCase() === 'check template syntax') return true;
  if (trimmed.toLowerCase() === 'ensure the value is defined') return true;
  if (trimmed.toLowerCase() === 'check that the function exists') return true;
  return false;
};

const isLowQualityCauses = (causes) => {
  if (!causes || causes.length === 0) return true;
  return causes.every(c => c.toLowerCase().includes('internal'));
};

describe('error definitions audit', () => {
  const META_ERROR_NAMES = ['LINE_INFO_MATCH', 'COLUMN_INFO_MATCH', 'INCLUDED_FROM_MATCH', 'INCLUDED_FROM_WITH_LINE_MATCH'];
  const errors = Object.entries(ERROR_DEFINITIONS).filter(([name]) => !META_ERROR_NAMES.includes(name));

  test('all error definitions have causes', () => {
    const missingCauses = [];
    for (const [name, def] of errors) {
      if (!def.causes || def.causes.length === 0) {
        missingCauses.push(name);
      }
    }
    expect(missingCauses).toEqual([]);
  });

  test('all error definitions have fixCode', () => {
    const missingFix = [];
    for (const [name, def] of errors) {
      if (!def.fixCode) {
        missingFix.push(name);
      }
    }
    expect(missingFix).toEqual([]);
  });

  test('fixCodes are not low quality placeholders', () => {
    const lowQuality = [];
    for (const [name, def] of errors) {
      if (def.fixCode && isLowQualityFix(def.fixCode)) {
        lowQuality.push(name);
      }
    }
    expect(lowQuality).toEqual([]);
  });

  test('causes are not low quality placeholders', () => {
    const lowQuality = [];
    for (const [name, def] of errors) {
      if (def.causes && isLowQualityCauses(def.causes)) {
        lowQuality.push(name);
      }
    }
    expect(lowQuality).toEqual([]);
  });

  test('each cause has at least 2 items', () => {
    const tooFewCauses = [];
    for (const [name, def] of errors) {
      if (def.causes && def.causes.length < 2) {
        tooFewCauses.push(name);
      }
    }
    expect(tooFewCauses).toEqual([]);
  });

  test('fixCode references template syntax when appropriate', () => {
    const errsNeedingTemplate = ['SYNTAX_ERROR', 'PARSER_UNEXPECTED_TOKEN', 'UNKNOWN_BLOCK_TAG', 'EXPECTED_VARIABLE_END', 'PARSER_VARIABLE_NAME', 'PARSER_EXPRESSION', 'PARSER_TAG_NAME'];
    const missingTemplateSyntax = [];
    for (const name of errsNeedingTemplate) {
      if (!ERROR_DEFINITIONS[name]) continue;
      const fix = ERROR_DEFINITIONS[name].fixCode;
      if (fix && !fix.includes('{') && !fix.includes('{%') && !fix.includes('{{') && !fix.includes('%}')) {
        missingTemplateSyntax.push(name);
      }
    }
    expect(missingTemplateSyntax).toEqual([]);
  });

  test('all error messages are non-empty strings', () => {
    const emptyMessages = [];
    for (const [name, def] of errors) {
      const msg = typeof def.message === 'function' ? def.message({}) : def.message;
      if (!msg || msg.trim().length === 0) {
        emptyMessages.push(name);
      }
    }
    expect(emptyMessages).toEqual([]);
  });

  test('all error definitions have patterns', () => {
    const noPattern = [];
    for (const [name, def] of errors) {
      if (!def.pattern || !(def.pattern instanceof RegExp)) {
        noPattern.push(name);
      }
    }
    expect(noPattern).toEqual([]);
  });
});

describe('error messages - sample output', () => {
  test('UNDEFINED_VARIABLE message includes subject', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE, { name: 'user.something' }, 'user.something', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    expect(err.subject).toBe('user.something');
    expect(err.message).toContain('user.something');
    expect(err.causes.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
  });

  test('NULL_VALUE error handles nested access', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.NULL_VALUE, { accessPath: 'name', parent: 'user', state: 'null' }, 'name', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    expect(err.message).toContain('name');
    expect(err.message).toContain('user');
  });

  test('FILE_NOT_FOUND has helpful message', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: 'missing.njk' }, 'missing.njk', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    expect(err.message).toContain('missing.njk');
    expect(err.fixCode).toBeTruthy();
  });

  test('UNDEFINED_FILTER has helpful fix', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNDEFINED_FILTER, { name: 'myFilter' }, 'myFilter', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    expect(err.message).toContain('myFilter');
    expect(err.fixCode).toContain('addFilter');
  });

  test('classification substitutes placeholders in causes', async () => {
    const { classifyFromError } = await import('@nunjucks/log');
    const cls = classifyFromError({
      code: 'UNDEFINED_PROPERTY',
      subject: 'something',
      message: "Property 'something' not found in 'user'"
    });

    expect(cls.causes.some(c => c.includes('something'))).toBe(true);
    expect(cls.causes.some(c => c.includes('user'))).toBe(true);
  });

  test('classification substitutes placeholders in fixCode', async () => {
    const { classifyFromError } = await import('@nunjucks/log');
    const cls = classifyFromError({
      code: 'UNDEFINED_FILTER',
      subject: 'myFilter',
      message: "Filter 'myFilter' is not defined"
    });

    expect(cls.fixCode).toContain('myFilter');
    expect(cls.fixCode).not.toContain('{subject}');
  });

  test('NULL_VALUE classification substitutes parent', async () => {
    const { classifyFromError } = await import('@nunjucks/log');
    const cls = classifyFromError({
      code: 'NULL_VALUE',
      message: "Cannot access 'name' on null 'user'"
    });

    expect(cls.causes.some(c => c.includes('user'))).toBe(true);
  });

  test('UNDEFINED_VARIABLE classification substitutes subject', async () => {
    const { classifyFromError } = await import('@nunjucks/log');
    const cls = classifyFromError({
      code: 'UNDEFINED_VARIABLE',
      message: "Variable 'foo' is not defined"
    });

    expect(cls.causes.some(c => c.includes('foo'))).toBe(true);
    expect(cls.fixCode).toContain('foo');
  });
});

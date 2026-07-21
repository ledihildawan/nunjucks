import { describe, test, expect } from 'bun:test';
import {
  createWhitelistError,
  createWhitelistValidator,
  scanASTForTags,
  validateTemplateWhitelist,
} from './whitelist.ts';

describe('WhitelistError', () => {
  test('uses default code WHITELIST_VIOLATION', () => {
    const err = createWhitelistError('nope');
    expect(err.name).toBe('WhitelistError');
    expect(err.code).toBe('WHITELIST_VIOLATION');
    expect(err.message).toBe('nope');
    expect(err).toBeInstanceOf(Error);
  });

  test('accepts a custom code', () => {
    const err = createWhitelistError('nope', 'CUSTOM');
    expect(err.code).toBe('CUSTOM');
  });
});

describe('createWhitelistValidator', () => {
  test('allows standard tags by default', () => {
    const v = createWhitelistValidator();
    expect(v.validateTag('for')).toBe(true);
    expect(v.validateTag('if')).toBe(true);
    expect(v.validateTag('block')).toBe(true);
  });

  test('allows unknown tags when not in strict mode', () => {
    expect(createWhitelistValidator().validateTag('customTag')).toBe(true);
  });

  test('blocks unknown tags in strict mode', () => {
    expect(createWhitelistValidator({ strict: true }).validateTag('customTag')).toBe(false);
  });

  test('blockedTags blocks a non-default tag', () => {
    const v = createWhitelistValidator({ blockedTags: ['customTag'] });
    expect(v.validateTag('customTag')).toBe(false);
  });

  test('blockedTags does not override a default-allowed tag', () => {
    const v = createWhitelistValidator({ blockedTags: ['for'] });
    expect(v.validateTag('for')).toBe(true);
  });

  test('custom allowedTags restricts the tag set (strict)', () => {
    const v = createWhitelistValidator({ allowedTags: ['for'], strict: true });
    expect(v.validateTag('for')).toBe(true);
    expect(v.validateTag('if')).toBe(false);
  });

  test('always blocks dangerous filters (eval/exec/compile)', () => {
    const v = createWhitelistValidator();
    expect(v.validateFilter('eval')).toBe(false);
    expect(v.validateFilter('exec')).toBe(false);
    expect(v.validateFilter('compile')).toBe(false);
  });

  test('allows standard filters by default', () => {
    const v = createWhitelistValidator();
    expect(v.validateFilter('upper')).toBe(true);
    expect(v.validateFilter('lower')).toBe(true);
    expect(v.validateFilter('escape')).toBe(true);
  });

  test('allows unknown filters when not in strict mode', () => {
    expect(createWhitelistValidator().validateFilter('custom')).toBe(true);
  });

  test('blocks unknown filters in strict mode', () => {
    expect(createWhitelistValidator({ strict: true }).validateFilter('custom')).toBe(false);
  });

  test('blockedFilters blocks a non-default filter', () => {
    const v = createWhitelistValidator({ blockedFilters: ['custom'] });
    expect(v.validateFilter('custom')).toBe(false);
  });

  test('blockedFilters does not override a default-allowed filter', () => {
    const v = createWhitelistValidator({ blockedFilters: ['upper'] });
    expect(v.validateFilter('upper')).toBe(true);
  });

  test('custom allowedFilters restricts the filter set (strict)', () => {
    const v = createWhitelistValidator({ allowedFilters: ['upper'], strict: true });
    expect(v.validateFilter('upper')).toBe(true);
    expect(v.validateFilter('lower')).toBe(false);
  });

  test('isTagAllowed and isFilterAllowed mirror the validators', () => {
    const v = createWhitelistValidator({ strict: true });
    expect(v.isTagAllowed('for')).toBe(true);
    expect(v.isTagAllowed('nope')).toBe(false);
    expect(v.isFilterAllowed('eval')).toBe(false);
    expect(v.isFilterAllowed('upper')).toBe(true);
  });

  test('getAllowedTags and getAllowedFilters return copies of the sets', () => {
    const v = createWhitelistValidator();
    expect(v.getAllowedTags()).toContain('for');
    expect(v.getAllowedFilters()).toContain('upper');
  });

  test('exposes options with resolved tag and filter lists', () => {
    const v = createWhitelistValidator({ allowedTags: ['for'], allowedFilters: ['upper'], strict: true });
    expect(v.options.allowedTags).toEqual(['for']);
    expect(v.options.allowedFilters).toEqual(['upper']);
    expect(v.options.strict).toBe(true);
  });
});

describe('scanASTForTags', () => {
  test('does nothing for null ast', () => {
    const visited: string[] = [];
    scanASTForTags(null, (node) => visited.push(node.type));
    expect(visited).toEqual([]);
  });

  test('visits nodes in traversal order across children, body, alternate and test', () => {
    const ast = {
      type: 'root',
      children: [
        { type: 'if', body: [{ type: 'output' }], test: { type: 'literal' } },
        { type: 'for', body: { type: 'block' }, alternate: { type: 'else' } },
      ],
    };
    const visited: string[] = [];
    scanASTForTags(ast, (node) => visited.push((node as { type: string }).type));
    expect(visited).toEqual(['root', 'if', 'output', 'literal', 'for', 'block', 'else']);
  });

  test('traverses args arrays and target/expr/name nodes', () => {
    const ast = {
      type: 'root',
      children: [
        {
          type: 'call',
          args: [{ type: 'literal' }],
          target: { type: 'lookup' },
          expr: { type: 'filter' },
          name: { type: 'symbol' },
        },
      ],
    };
    const visited: string[] = [];
    scanASTForTags(ast, (node) => visited.push((node as { type: string }).type));
    expect(visited).toContain('literal');
    expect(visited).toContain('lookup');
    expect(visited).toContain('filter');
    expect(visited).toContain('symbol');
  });

  test('ignores non-object name values like strings', () => {
    const ast = { type: 'tag', name: 'stringname' };
    const visited: string[] = [];
    scanASTForTags(ast, (node) => visited.push((node as { type: string }).type));
    expect(visited).toEqual(['tag']);
  });
});

describe('validateTemplateWhitelist', () => {
  test('returns valid when all controlled tags are allowed', () => {
    const validator = createWhitelistValidator();
    const ast = { type: 'root', children: [{ type: 'block' }, { type: 'extends' }] };
    const result = validateTemplateWhitelist(ast, validator);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('reports a violation for a tag excluded by strict allowedTags', () => {
    const validator = createWhitelistValidator({
      allowedTags: ['block', 'extends', 'include'],
      strict: true,
    });
    const ast = { type: 'root', children: [{ type: 'import', lineno: 3, colno: 0 }] };
    const result = validateTemplateWhitelist(ast, validator);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ type: 'tag', name: 'import', lineno: 3, colno: 0 });
  });

  test('does not flag non-controlled node types', () => {
    const validator = createWhitelistValidator({ blockedTags: ['import'] });
    const ast = { type: 'root', children: [{ type: 'output' }, { type: 'for' }] };
    const result = validateTemplateWhitelist(ast, validator);
    expect(result.valid).toBe(true);
  });
});

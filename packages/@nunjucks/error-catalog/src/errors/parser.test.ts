import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';
import { createErrorDefinition } from './factory.ts';
import { PARSER_ERRORS } from './parser.ts';

const DOCS_BASE = 'https://github.com/ledihildawan/nunjucks/blob/main/docs/templating.md';

describe('PARSER_ERRORS definitions', () => {
  test('every entry is keyed by its own name and carries a category plus guidance', () => {
    for (const [name, def] of Object.entries(PARSER_ERRORS)) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixCode).toBeTruthy();
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('documentationUrls point at the templating docs anchors', () => {
    expect(PARSER_ERRORS.SYNTAX_ERROR.documentationUrl).toBe(`${DOCS_BASE}#tags`);
    expect(PARSER_ERRORS.PARSER_UNEXPECTED_TOKEN.documentationUrl).toBe(`${DOCS_BASE}#expressions`);
    expect(PARSER_ERRORS.PARSER_TAG_NAME.documentationUrl).toBe(`${DOCS_BASE}#tags`);
    expect(PARSER_ERRORS.PARSER_ERROR.documentationUrl).toBe(`${DOCS_BASE}#tags`);
    expect(PARSER_ERRORS.UNKNOWN_BLOCK_TAG.documentationUrl).toBe(`${DOCS_BASE}#tags`);
  });

  test('createErrorDefinition-built entries match their literal message and interpolate placeholders', () => {
    const tokenDef = PARSER_ERRORS.PARSER_UNEXPECTED_TOKEN;
    expect(tokenDef.pattern.test("Unexpected token '}' while parsing")).toBe(true);
    expect(tokenDef.message.replaceAll('{token}', '}')).toBe("Unexpected token '}' while parsing");

    expect(PARSER_ERRORS.PARSER_EXPECTED.pattern.test('expected comma')).toBe(true);
    expect(PARSER_ERRORS.PARSER_EXPECTED.message.replaceAll('{expected}', 'comma')).toBe(
      'expected comma'
    );

    expect(PARSER_ERRORS.UNKNOWN_BLOCK_TAG.pattern.test('unknown block tag: iff')).toBe(true);
    expect(PARSER_ERRORS.UNKNOWN_BLOCK_TAG.message.replaceAll('{tag}', 'iff')).toBe(
      'unknown block tag: iff'
    );
  });
});

describe('SYNTAX_ERROR pattern', () => {
  test('recognizes the raw throw shapes it lists', () => {
    const { pattern } = PARSER_ERRORS.SYNTAX_ERROR;
    for (const message of [
      'unexpected token: }',
      'unexpected end of file',
      'Unexpected end of input',
      'parse error at line 3',
      'expected arguments',
      'expected right bracket',
      'expected block end but got raw',
      'tag name expected',
      'invalid boolean',
      'expected expression, got end of file',
    ]) {
      expect(pattern.test(message)).toBe(true);
    }
  });

  test('rejects unrelated messages', () => {
    expect(PARSER_ERRORS.SYNTAX_ERROR.pattern.test('all good here')).toBe(false);
  });
});

describe('hand-written parser patterns', () => {
  test('PARSER_EXPECTED_IN matches the prefixed and bare throw shapes', () => {
    const { pattern } = PARSER_ERRORS.PARSER_EXPECTED_IN;
    expect(pattern.test('parseFor: expected "in" keyword for loop')).toBe(true);
    expect(pattern.test('expected "in" keyword for loop')).toBe(true);
    expect(pattern.test('expected "of" keyword for loop')).toBe(false);
  });

  test('PARSER_VARIABLE_NAME matches the prefixed and bare throw shapes', () => {
    const { pattern } = PARSER_ERRORS.PARSER_VARIABLE_NAME;
    expect(pattern.test('parseFor: variable name expected')).toBe(true);
    expect(pattern.test('variable name expected')).toBe(true);
    expect(pattern.test('tag name expected')).toBe(false);
  });

  test('PARSER_TAG_NAME matches the bare and parse-prefixed throw shapes', () => {
    const { pattern } = PARSER_ERRORS.PARSER_TAG_NAME;
    expect(pattern.test('tag name expected')).toBe(true);
    expect(pattern.test('parseBlock: expected if')).toBe(true);
    expect(pattern.test('parseBlock: expected "quoted"')).toBe(false);
  });

  test('PARSER_EXPRESSION matches end-of-file and parseAggregate shapes', () => {
    const { pattern } = PARSER_ERRORS.PARSER_EXPRESSION;
    expect(pattern.test('expected expression, got end of file')).toBe(true);
    expect(pattern.test('parseAggregate: expected comma')).toBe(true);
    expect(pattern.test('expected expression')).toBe(false);
  });
});

describe('factory-built parser entries derive the documented invariants', () => {
  test('severity defaults to error and subjectFrom is set for placeholder messages', () => {
    const def = PARSER_ERRORS.PARSER_UNEXPECTED_TOKEN;
    expect(def.severity).toBe('error');
    expect(def.subjectFrom).not.toBeNull();
    expect(def.titleTemplate).toBe(def.message);
  });

  test('entries without placeholders have a null subjectFrom', () => {
    expect(PARSER_ERRORS.PARSER_ERROR.subjectFrom).toBeNull();
    expect(PARSER_ERRORS.EXPECTED_VARIABLE_END.subjectFrom).toBeNull();
    expect(PARSER_ERRORS.INVALID_BOOLEAN.subjectFrom).toBeNull();
  });

  test('hand-written entries omit severity, which classification defaults to error', () => {
    expect((PARSER_ERRORS.SYNTAX_ERROR as { severity?: string }).severity).toBeUndefined();
    expect((PARSER_ERRORS.PARSER_EXPECTED_IN as { severity?: string }).severity).toBeUndefined();
    expect(classifyFromError({ message: 'variable name expected' }).severity).toBe('error');
  });
});

describe('category completeness', () => {
  test('the known set of parser categories is used and non-empty', () => {
    const categories = new Set(Object.values(PARSER_ERRORS).map((def) => def.category));
    expect(categories).toContain('syntax_error');
    expect(categories).toContain('unknown_block_tag');
    for (const category of categories) {
      expect(category).not.toBe('');
    }
  });

  test('UNKNOWN_BLOCK_TAG entries interoperate with the factory escape hatch', () => {
    const rebuilt = createErrorDefinition({
      name: 'UNKNOWN_BLOCK_TAG',
      message: 'unknown block tag: {tag}',
      category: 'unknown_block_tag',
      causes: [],
    });
    expect(rebuilt.pattern.source).toBe(PARSER_ERRORS.UNKNOWN_BLOCK_TAG.pattern.source);
    expect(rebuilt.pattern.flags).toBe(PARSER_ERRORS.UNKNOWN_BLOCK_TAG.pattern.flags);
  });
});

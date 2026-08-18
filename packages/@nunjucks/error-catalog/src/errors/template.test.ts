import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';
import { TEMPLATE_ERRORS } from './template.ts';

describe('TEMPLATE_ERRORS definitions', () => {
  test('each entry is keyed by its own name and carries guidance', () => {
    for (const [name, def] of Object.entries(TEMPLATE_ERRORS)) {
      expect(def.name).toBe(name as typeof def.name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixComment).toBeTruthy();
      expect(def.subjectFrom).toBeDefined();
    }
  });
});

describe('VALIDATION_ERROR', () => {
  test('classification substitutes the extracted key into title and fixCode', () => {
    const cls = classifyFromError({ message: "Invalid value for 'maxOutputSize'" });
    expect(cls.category).toBe('validation_error');
    expect(cls.undefinedName).toBe('maxOutputSize');
    expect(cls.title).toBe("Invalid value for 'maxOutputSize'");
    expect(cls.fixCode).toContain('maxOutputSize');
  });
});

describe('INVALID_IDENTIFIER', () => {
  test('pattern captures the identifier and classification echoes it in the title', () => {
    const match = "Invalid identifier 'my-block'".match(TEMPLATE_ERRORS.INVALID_IDENTIFIER.pattern);
    expect(match?.[1]).toBe('my-block');
    const cls = classifyFromError({ message: "Invalid identifier 'my-block'" });
    expect(cls.category).toBe('invalid_template');
    expect(cls.title).toBe("Invalid identifier 'my-block'");
  });
});

describe('INVALID_CONFIG', () => {
  test('classification substitutes the offending option name into guidance', () => {
    const cls = classifyFromError({
      message: 'Invalid configuration: executionTimeout must be >= 0',
    });
    expect(cls.category).toBe('validation_error');
    expect(cls.undefinedName).toBe('executionTimeout');
    expect(cls.fixComment).toContain('executionTimeout');
  });
});

describe('size limit definitions', () => {
  test('TEMPLATE_SIZE_EXCEEDED recognizes realistic throw shapes', () => {
    expect(
      classifyFromError({ message: 'Template exceeds maximum size of 1048576 characters' }).category
    ).toBe('validation_error');
  });

  test('OUTPUT_SIZE_EXCEEDED recognizes realistic throw shapes', () => {
    expect(
      classifyFromError({ message: 'Rendered output exceeds maximum size of 1000000 characters' })
        .category
    ).toBe('validation_error');
  });
});

describe('anchored bare-message definitions', () => {
  test('TEMPLATE_SRC_STRING matches only its exact message', () => {
    expect(
      TEMPLATE_ERRORS.TEMPLATE_SRC_STRING.pattern.test('Template src must be a string or an object')
    ).toBe(true);
    expect(
      TEMPLATE_ERRORS.TEMPLATE_SRC_STRING.pattern.test('src must be a string or an object')
    ).toBe(false);
  });

  test('TEMPLATE_MUST_BE_STRING matches only its exact message', () => {
    expect(TEMPLATE_ERRORS.TEMPLATE_MUST_BE_STRING.pattern.test('Template must be a string')).toBe(
      true
    );
    expect(TEMPLATE_ERRORS.TEMPLATE_MUST_BE_STRING.pattern.test('template must be a string!')).toBe(
      false
    );
  });
});

describe('unanchored loader/compiler definitions', () => {
  test('TEMPLATE_INVALID_SOURCE recognizes the loader throw shape', () => {
    expect(
      TEMPLATE_ERRORS.TEMPLATE_INVALID_SOURCE.pattern.test(
        'src must be a string or an object describing the source'
      )
    ).toBe(true);
    expect(
      classifyFromError({ message: 'src must be a string or an object describing the source' })
        .category
    ).toBe('invalid_template');
  });

  test('TEMPLATE_NO_RENDER recognizes the unexpected-template-object shape', () => {
    expect(classifyFromError({ message: 'Unexpected template object type' }).category).toBe(
      'invalid_template'
    );
  });

  test('INVALID_CODE_FORMAT recognizes the unrecognized-code-format shape', () => {
    expect(classifyFromError({ message: 'Unrecognized code format' }).category).toBe(
      'invalid_template'
    );
    expect(TEMPLATE_ERRORS.INVALID_CODE_FORMAT.documentationUrl).toContain('#compile');
  });

  test('WALK_UNKNOWN_TYPE classifies as an internal error pointing at the tracker', () => {
    const cls = classifyFromError({ message: "walk: unknown node type 'FancyNode'" });
    expect(cls.category).toBe('internal_error');
    expect(cls.documentationUrl).toBe('https://github.com/mozilla/nunjucks/issues');
  });
});

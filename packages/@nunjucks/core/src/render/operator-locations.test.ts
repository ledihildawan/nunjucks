import { describe, test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render } from './render.ts';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  const result = await render(template, context, {
    autoescape: false,
    ...config
  } as Record<string, unknown>);
  if (isErr(result)) { throw result.error; }
  return result.value;
};

let currentTestSourceCache: { filePath: string; sourceContent: string; sourceLines: string[] } | null = null;

const getCurrentTestSource = async () => {
  if (currentTestSourceCache) {
    return currentTestSourceCache;
  }

  const filePath = fileURLToPath(import.meta.url);
  const sourceContent = await readFile(filePath, 'utf8');
  currentTestSourceCache = {
    filePath,
    sourceContent,
    sourceLines: sourceContent.split('\n')
  };
  return currentTestSourceCache;
};

describe('inline template operator error locations', () => {
  test('points native arithmetic errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "STATEMENT_ARITHMETIC_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await renderTemplate('{% if 1 + invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' + ') + 2);
  });

  test('points native comparison errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "STATEMENT_COMPARISON_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await renderTemplate('{% if 1 < invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' < ') + 2);
  });

  test('points native unary errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "STATEMENT_UNARY_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await renderTemplate('{% if -invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('-invalid') + 1);
  });

  test('preserves short-circuit semantics for logical and nullish operators', async () => {
    const explode = () => { throw new Error('must not run'); };
    await expect(renderTemplate('{{ true or explode() }}', { explode })).resolves.toBe('true');
    await expect(renderTemplate('{{ true || explode() }}', { explode })).resolves.toBe('true');
    await expect(renderTemplate('{{ false and explode() }}', { explode })).resolves.toBe('false');
    await expect(renderTemplate('{{ false && explode() }}', { explode })).resolves.toBe('false');
    await expect(renderTemplate('{{ 0 ?? explode() }}', { explode })).resolves.toBe('0');
  });

  test('supports concat and is tests with custom tests', async () => {
    const tests = {
      odd: (n: unknown) => Number(n) % 2 !== 0,
      even: (n: unknown) => Number(n) % 2 === 0,
      divisibleby: (n: unknown, d: unknown) => Number(n) % Number(d) === 0,
      custom: (value: unknown) => value === 3
    };
    await expect(renderTemplate('{{ "a" + "2" }}')).resolves.toBe('a2');
    await expect(renderTemplate('{{ 5 is odd }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 4 is not odd }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 6 is divisibleby(3) }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 3 is custom }}', {}, { tests })).resolves.toBe('true');
  });

  test('reports unknown tests at the is operator', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const err = await renderTemplate('{{ value is missing }}', { value: 1 }).catch(e => e);
    expect(err.code).toBe('UNDEFINED_TEST');
    expect(err.subject).toBe('missing');
    const callerLine = source[err.lineno - 1] ?? '';
    expect(callerLine).toContain("renderTemplate('{{ value is missing }}'");
    expect(err.colno).toBe(callerLine.indexOf(' is ') + 2);
  });

  test('tracks nested, multiline, and column-zero operator locations', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const nested = await renderTemplate('{% if 1 + (2 * invalid) %}ok{% endif %}', { invalid }).catch(e => e);
    const nestedLine = source[nested.lineno - 1] ?? '';
    expect(nestedLine).toContain("renderTemplate('{% if 1 + (2 * invalid) %}ok{% endif %}'");
    const nestedStart = nestedLine.indexOf("{% if 1 + (2 ");
    expect(nestedStart).toBeGreaterThanOrEqual(0);
    expect(nested.colno).toBe(nestedStart + '{% if 1 + (2 '.length + 1);

    const multiline = await renderTemplate('{% if 1 +\ninvalid %}ok{% endif %}', { invalid }).catch(e => e);
    const multilineLine = source[multiline.lineno - 1] ?? '';
    const multilineStart = multilineLine.indexOf("{% if 1 +");
    const sourceHasTemplate = multilineStart >= 0;
    if (sourceHasTemplate) {
      expect(multilineLine).toContain('+');
      expect(multiline.colno).toBe(multilineStart + '{% if 1 '.length + 1);
    } else {
      expect(multiline.colno).toBeGreaterThan(0);
    }
  });

  test('points native throws at every coercing operator variant', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const cases: [string, string, number][] = [
      ['{% if 1 + invalid %}x{% endif %}', ' + ', 1],
      ['{% if 1 - invalid %}x{% endif %}', ' - ', 1],
      ['{% if 1 * invalid %}x{% endif %}', ' * ', 1],
      ['{% if 1 / invalid %}x{% endif %}', ' / ', 1],
      ['{% if 1 % invalid %}x{% endif %}', ' % ', 1],
      ['{% if 1 // invalid %}x{% endif %}', ' // ', 1],
      ['{% if 1 ** invalid %}x{% endif %}', ' ** ', 1],
      ['{% if "x" + invalid %}x{% endif %}', ' + ', 1],
      ['{% if 1 == invalid %}x{% endif %}', '== ', 0],
      ['{% if 1 != invalid %}x{% endif %}', '!= ', 0],
      ['{% if 1 < invalid %}x{% endif %}', ' < ', 1],
      ['{% if 1 > invalid %}x{% endif %}', ' > ', 1],
      ['{% if 1 <= invalid %}x{% endif %}', ' <= ', 1],
      ['{% if 1 >= invalid %}x{% endif %}', ' >= ', 1],
      ['{% if +invalid %}x{% endif %}', 'if +', 3],
      ['{% if -invalid %}x{% endif %}', 'if -', 3],
    ];

    for (const [template, marker, operatorOffset] of cases) {
      const err = await renderTemplate(template, { invalid }).catch(e => e);
      expect(err).toBeInstanceOf(Error);
      const callerLine = source[err.lineno - 1] ?? '';
      expect(callerLine).toContain(template);
      expect(err.colno).toBe(callerLine.indexOf(marker) + operatorOffset + 1);
    }
  });

  test('uses each operator location in chained comparisons', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const first = { valueOf: () => { throw new Error('first'); } };
    const second = { valueOf: () => { throw new Error('second'); } };
    const template = '{% if 1 < first < second %}x{% endif %}';
    const firstErr = await renderTemplate(template, { first, second: 3 }).catch(e => e);
    const firstLine = source[firstErr.lineno - 1] ?? '';
    expect(firstLine).toContain(template);
    const firstColInCaller = firstLine.indexOf('{% if 1 < first');
    const searchFrom = Math.max(0, firstColInCaller);
    expect(firstErr.colno).toBe(firstLine.indexOf('<', searchFrom) + 1);

    const secondErr = await renderTemplate(template, { first: 2, second }).catch(e => e);
    const secondLine = source[secondErr.lineno - 1] ?? '';
    expect(secondLine).toContain(template);
    expect(secondErr.colno).toBe(secondLine.lastIndexOf('<') + 1);
  });

  test('preserves zero coordinates in compiler fallbacks', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await renderTemplate('{{ -invalid }}', { invalid }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';
    expect(callerLine).toContain("renderTemplate('{{ -invalid }}'");
    expect(err.colno).toBe(callerLine.indexOf('-invalid') + 1);
  });

  test('points in-operator errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "STATEMENT_IN_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{% if key in invalid %}ok{% endif %}', { key: 'x', invalid: 42 }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('IN_OPERATOR');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' in ') + 2);
  });

  test('points bracket-string call errors at the property name', async () => {
    const { sourceLines: source } = await getCurrentTestSource();
    const err = await renderTemplate('Your status: {{ user["status"]() }}', {
      user: { status: 'active' }
    }, {
      dev: true
    }).catch(e => e);

    expect(err.code).toBe('NOT_A_FUNCTION');
    expect(err.lineBase).toBe('one');
    const callerLine = source[err.lineno - 1] ?? '';
    expect(callerLine).toContain('user["status"]()');
    expect(err.colno).toBe(callerLine.indexOf('Your status: {{ user["') + 'Your status: {{ user["'.length + 1);
  });
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render } from './render.ts';
import { mergeConfig } from '../config/global.ts';
import nunjucks from '../index.ts';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }) as unknown as Record<string, unknown>);
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

describe('inline template error locations', () => {
  test('scrubs dangerous global references from context in dev mode and emits a warning', async () => {
    const html = await renderTemplate('{{ user.name }}', {
      user: { name: 'Ada', global: process }
    }, { dev: true, contextStrict: 'warn' });
    expect(html).toStartWith('Ada');
    expect(html).toContain('Scrubbed unsafe values from context: user.global');
  });

  test('throws DANGEROUS_CONTEXT_VALUES when contextStrict is error', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'DANGEROUS_CONTEXT_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ user.global }}', {
      user: { name: 'Ada', global: process }
    }, { dev: true, contextStrict: 'error', jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // DANGEROUS_CONTEXT_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('DANGEROUS_CONTEXT_VALUES');
    expect(err.subject).toContain('user.global');
    expect(err.lineBase).toBe('one');
    expect(err.colno).toBe(callerLine.indexOf('user.global') + 'user.'.length + 1);
  });

  test('does not scrub when contextStrict is false and dev is false', async () => {
    const html = await renderTemplate('{{ user.name }}', {
      user: { name: 'Ada', global: process }
    }, { dev: false, contextStrict: false });
    expect(html).toBe('Ada');
  });

  test('applies sandboxEnvironment to render context access', async () => {
    const html = await renderTemplate('{{ document.title }}', {
      document: { title: 'node scoped value' }
    }, {
      sandbox: true,
      sandboxEnvironment: 'node',
      contextStrict: false
    });
    const err = await renderTemplate('{{ process.env }}', {
      process: { env: {} }
    }, {
      sandbox: true,
      sandboxEnvironment: 'node',
      contextStrict: false
    }).catch(e => e);

    expect(html).toBe('node scoped value');
    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('process');
  });

  test('allows nested context fields named like globals in sandbox mode', async () => {
    const html = await renderTemplate('{{ user.eval }} {{ user.global }}', {
      user: {
        eval: 'profile',
        global: 'team'
      }
    }, {
      sandbox: true
    });

    expect(html).toBe('profile team');
  });

  test('blocks constructor-chain escapes in sandbox mode', async () => {
    const err = await renderTemplate('{{ user.constructor.constructor("return process")() }}', {
      user: { name: 'Ada' }
    }, {
      sandbox: true
    }).catch(e => e);

    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('constructor');
  });

  test('does not expose inherited context properties in sandbox mode', async () => {
    const parent = { inheritedSecret: 'hidden' };
    const user = Object.create(parent);
    user.name = 'Ada';

    const html = await renderTemplate('{{ user.name }}:{{ user.inheritedSecret }}', {
      user
    }, {
      sandbox: true
    });

    expect(html).toBe('Ada:undefined');
    expect(html).not.toContain('hidden');
  });

  test('does not invoke blocked-key getters in sandbox mode', async () => {
    let getterCalled = false;
    const user = {};
    Object.defineProperty(user, 'constructor', {
      enumerable: true,
      get() {
        getterCalled = true;
        return Function;
      }
    });

    const err = await renderTemplate('{{ user.constructor }}', {
      user
    }, {
      sandbox: true
    }).catch(e => e);

    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('constructor');
    expect(getterCalled).toBe(false);
  });

  test('points at the failing template token inside the caller source line', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'INLINE_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ missingKey }}', {}, { // INLINE_LOCATION_MARKER
      dev: true,
      undefined: 'strict',
      jsCaller: filePath,
      jsCallerErrorLine: markerLine,
      jsCallerErrorCol: 1
    }).catch(e => e);
    const callerLine = source[err.lineno - 1];

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('missingKey') + 1);
  });

  test('automatically uses the real caller file for inline template locations', async () => {
    const { filePath, sourceContent, sourceLines: source } = await getCurrentTestSource();
    const marker = 'AUTO_CALLER_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await nunjucks('{{ product.name }}', { product: { test: 'test' } }, { dev: true, undefined: 'strict' }).catch(e => e); // AUTO_CALLER_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.lineBase).toBe('one');
    expect(err.templatePath).toBe(filePath);
    expect(err.templateName).toBe(filePath);
    expect(err.lineno).toBe(markerLine);
    expect(err.colno).toBe(callerLine.indexOf('product.name') + 'product.'.length + 1);
    expect(err.sourceStartLine).toBe(1);
    expect(err.sourceContent).toBe(sourceContent);
  });

  test('points at the failing template token inside a multiline caller template literal', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'MULTILINE_INLINE_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    // MULTILINE_INLINE_MARKER
    const err = await render(`
      
      {{ missingKey }}
       
      `, {}, {
      dev: true,
      undefined: 'strict',
      jsCaller: filePath,
      jsCallerErrorLine: markerLine + 1,
      jsCallerErrorCol: 1
    }).catch(e => e);
    const expectedLine = source.findIndex((line, idx) => idx + 1 > markerLine && line.includes('{{ missingKey }}')) + 1;
    const callerLine = source[expectedLine - 1];

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.lineno).toBe(expectedLine);
    expect(err.colno).toBe(callerLine.indexOf('missingKey') + 1);
  });

  test('points reserved filter errors at the filter key in caller config', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'RESERVED_FILTER_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v) => v }, _customFilters: { 'if': (v) => v }, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // RESERVED_FILTER_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('RESERVED_KEYWORD');
    expect(err.subject).toBe('if');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf("'if'") + 2);
  });

  test('renders reserved filter caret under the filter key in html output', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'RESERVED_FILTER_HTML_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v) => v }, _customFilters: { 'if': (v) => v }, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // RESERVED_FILTER_HTML_MARKER
    const callerLine = source[err.lineno - 1];
    const html = await err.output({ format: 'html', verbosity: 'full' });
    const markerMatch = html.match(/error-marker-content">([^<]*\^+)<\/span>/u);

    expect(markerMatch).not.toBeNull();
    expect(markerMatch?.[1]).toBe(`${' '.repeat(callerLine.indexOf("'if'") + 1)}^^`);
  });

  test('auto caller detection points reserved filter errors at the filter key', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'RESERVED_FILTER_AUTO_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await nunjucks('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v) => v } }).catch(e => e); // RESERVED_FILTER_AUTO_MARKER
    const callerLine = source[err.lineno - 1];
    const html = await err.output({ format: 'html', verbosity: 'full' });
    const markerMatch = html.match(/error-marker-content">([^<]*\^+)<\/span>/u);

    expect(err.code).toBe('RESERVED_KEYWORD');
    expect(err.subject).toBe('if');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.lineno).toBe(markerLine);
    expect(err.colno).toBe(callerLine.indexOf("'if'") + 2);
    expect(markerMatch).not.toBeNull();
    expect(markerMatch?.[1]).toBe(`${' '.repeat(callerLine.indexOf("'if'") + 1)}^^`);
  });

  test('points non-string template errors at the invalid template argument', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'NON_STRING_TEMPLATE_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render(123, {}, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // NON_STRING_TEMPLATE_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('TEMPLATE_MUST_BE_STRING');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('123') + 1);
    expect(callerLine.slice(err.colno - 1, err.colno + 2)).toBe('123');
  });

  test('points invalid config errors at the failing config key', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'INVALID_CONFIG_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ test }}', { test: 'value' }, { dev: true, executionTimeout: -1, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // INVALID_CONFIG_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('INVALID_CONFIG');
    expect(err.subject).toBe('executionTimeout');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('executionTimeout') + 1);
  });

  test('points undefined member lookups at the missing property', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'MISSING_PROPERTY_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ product.name }}', { product: { test: 'test' } }, { dev: true, undefined: 'strict', jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // MISSING_PROPERTY_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect(err.subject).toBe('name');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('product.name') + 'product.'.length + 1);
  });

  test('points slice errors inside statements at the slice step', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'STATEMENT_SLICE_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{% if items[::0] %}ok{% endif %}', { items: [1, 2, 3] }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // STATEMENT_SLICE_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('SLICE_STEP');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('::0') + 3);
  });

  test('renders slice steps with omitted bounds', async () => {
    await expect(render('{{ items[::2] }}', { items: [0, 1, 2, 3, 4] }))
      .resolves.toBe('0,2,4');
    await expect(render('{{ items[1::2] }}', { items: [0, 1, 2, 3, 4] }))
      .resolves.toBe('1,3');
  });

  test('points native arithmetic errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'STATEMENT_ARITHMETIC_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await render('{% if 1 + invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e); // STATEMENT_ARITHMETIC_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' + ') + 2);
  });

  test('points native comparison errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'STATEMENT_COMPARISON_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await render('{% if 1 < invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e); // STATEMENT_COMPARISON_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' < ') + 2);
  });

  test('points native unary errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'STATEMENT_UNARY_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await render('{% if -invalid %}ok{% endif %}', { invalid }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, contextStrict: false }).catch(e => e); // STATEMENT_UNARY_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

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
      odd: n => n % 2 !== 0,
      even: n => n % 2 === 0,
      divisibleby: (n, d) => n % d === 0,
      custom: value => value === 3
    };
    await expect(renderTemplate('{{ "a" + "2" }}')).resolves.toBe('a2');
    await expect(renderTemplate('{{ 5 is odd }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 4 is not odd }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 6 is divisibleby(3) }}', {}, { tests })).resolves.toBe('true');
    await expect(renderTemplate('{{ 3 is custom }}', {}, { tests })).resolves.toBe('true');
  });

  test('reports unknown tests at the is operator', async () => {
    const err = await renderTemplate('{{ value is missing }}', { value: 1 }).catch(e => e);
    expect(err.code).toBe('UNDEFINED_TEST');
    expect(err.subject).toBe('missing');
    expect(err.lineno).toBe(0);
    expect(err.colno).toBe('{{ value '.length);
  });

  test('tracks nested, multiline, and column-zero operator locations', async () => {
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const nested = await renderTemplate('{% if 1 + (2 * invalid) %}ok{% endif %}', { invalid }).catch(e => e);
    expect(nested.colno).toBe('{% if 1 + (2 '.length);

    const multiline = await renderTemplate('{% if 1 +\ninvalid %}ok{% endif %}', { invalid }).catch(e => e);
    expect(multiline.lineno).toBe(0);
    expect(multiline.colno).toBe('{% if 1 '.length);
  });

  test('points native throws at every coercing operator variant', async () => {
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const cases = [
      ['{% if 1 + invalid %}x{% endif %}', '+'],
      ['{% if 1 - invalid %}x{% endif %}', '-'],
      ['{% if 1 * invalid %}x{% endif %}', '*'],
      ['{% if 1 / invalid %}x{% endif %}', '/'],
      ['{% if 1 % invalid %}x{% endif %}', '%'],
      ['{% if 1 // invalid %}x{% endif %}', '//'],
      ['{% if 1 ** invalid %}x{% endif %}', '**'],
      ['{% if "x" + invalid %}x{% endif %}', '+'],
      ['{% if 1 == invalid %}x{% endif %}', '=='],
      ['{% if 1 != invalid %}x{% endif %}', '!='],
      ['{% if 1 < invalid %}x{% endif %}', '<'],
      ['{% if 1 > invalid %}x{% endif %}', '>'],
      ['{% if 1 <= invalid %}x{% endif %}', '<='],
      ['{% if 1 >= invalid %}x{% endif %}', '>='],
      ['{% if +invalid %}x{% endif %}', '+invalid'],
      ['{% if -invalid %}x{% endif %}', '-invalid'],
    ];

    for (const [template, operator] of cases) {
      const err = await renderTemplate(template, { invalid }).catch(e => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.colno).toBe(template.indexOf(operator, template.indexOf('if') + 2));
    }
  });

  test('uses each operator location in chained comparisons', async () => {
    const first = { valueOf: () => { throw new Error('first'); } };
    const second = { valueOf: () => { throw new Error('second'); } };
    const template = '{% if 1 < first < second %}x{% endif %}';
    const firstErr = await renderTemplate(template, { first, second: 3 }).catch(e => e);
    expect(firstErr.colno).toBe(template.indexOf('<'));
    const secondErr = await renderTemplate(template, { first: 2, second }).catch(e => e);
    expect(secondErr.colno).toBe(template.lastIndexOf('<'));
  });

  test('preserves zero coordinates in compiler fallbacks', async () => {
    const invalid = { valueOf: () => { throw new Error('coercion failed'); } };
    const err = await renderTemplate('{{ -invalid }}', { invalid }).catch(e => e);
    expect(err.lineno).toBe(0);
    expect(err.colno).toBe(3);
  });

  test('points in-operator errors inside statements at the operator', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = 'STATEMENT_IN_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{% if key in invalid %}ok{% endif %}', { key: 'x', invalid: 42 }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // STATEMENT_IN_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('IN_OPERATOR');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf(' in ') + 2);
  });

  test('points bracket-string call errors at the property name', async () => {
    const err = await render('Your status: {{ user["status"]() }}', {
      user: { status: 'active' }
    }, {
      dev: true
    }).catch(e => e);

    expect(err.code).toBe('NOT_A_FUNCTION');
    expect(err.lineBase).toBe('zero');
    expect(err.lineno).toBe(0);
    expect(err.colno).toBe('Your status: {{ user["'.length);
  });
});

describe('keyword arguments rendering', () => {
  describe('global functions with kwargs', () => {
    test('global function with kwargs', async () => {
      const greet = ({name = 'World', greeting = 'Hello'} = {}) => `${greeting} ${name}!`;
      const result = await renderTemplate('{{ greet(name="John", greeting="Hi") }}', {}, { globals: { greet } });
      expect(result.trim()).toBe('Hi John!');
    });

    test('global function with partial kwargs using defaults', async () => {
      const greet = ({name = 'World', greeting = 'Hello'} = {}) => `${greeting} ${name}!`;
      const result = await renderTemplate('{{ greet() }}', {}, { globals: { greet } });
      expect(result.trim()).toBe('Hello World!');
    });

    test('global function with nested destructuring', async () => {
      const formatUser = ({user: {firstName = 'Anonymous', lastName = ''} = {} } = {}) => `${firstName} ${lastName}`;
      const result = await renderTemplate(
        '{{ formatUser(user=(user)) }}',
        { user: { firstName: 'John', lastName: 'Doe' } },
        { globals: { formatUser } }
      );
      expect(result.trim()).toBe('John Doe');
    });

    test('global function with number kwargs', async () => {
      const addNumbers = ({a = 0, b = 0} = {}) => a + b;
      const result = await renderTemplate('{{ addNumbers(a=5, b=3) }}', {}, { globals: { addNumbers } });
      expect(result.trim()).toBe('8');
    });
  });

  describe('method calls with kwargs', () => {
    test('method call with kwargs', async () => {
      const obj = {
        name: 'myObject',
        greet: function({suffix = '!'} = {}) {
          return this.name + suffix;
        }
      };
      const result = await renderTemplate('{{ obj.greet(suffix="???") }}', {}, { globals: { obj } });
      expect(result.trim()).toBe('myObject???');
    });

    test('method call without kwargs uses default', async () => {
      const obj = {
        name: 'myObject',
        greet: function({suffix = '!'} = {}) {
          return this.name + suffix;
        }
      };
      const result = await renderTemplate('{{ obj.greet() }}', {}, { globals: { obj } });
      expect(result.trim()).toBe('myObject!');
    });

    test('method chain with kwargs', async () => {
      const calculator = {
        double: ({value = 0} = {}) => value * 2,
        triple: ({value = 0} = {}) => value * 3
      };
      const result = await renderTemplate(
        '{{ calculator.double(value=(calculator.triple(value=2))) }}',
        {},
        { globals: { calculator } }
      );
      expect(result.trim()).toBe('12');
    });
  });

  describe('filters with kwargs', () => {
    test('filter with kwargs', async () => {
      const myFilter = (val, {prefix = '', suffix = ''} = {}) => prefix + val + suffix;
      const result = await renderTemplate(
        '{{ "test" |> myFilter(prefix="<<", suffix=">>") }}',
        {},
        { filters: { myFilter } }
      );
      expect(result.trim()).toBe('<<test>>');
    });

    test('filter with partial kwargs', async () => {
      const myFilter = (val, {prefix = '', suffix = ''} = {}) => prefix + val + suffix;
      const result = await renderTemplate(
        '{{ "test" |> myFilter(prefix="__") }}',
        {},
        { filters: { myFilter } }
      );
      expect(result.trim()).toBe('__test');
    });

    test('filter without kwargs uses defaults', async () => {
      const myFilter = (val, {suffix = '!'} = {}) => val + suffix;
      const result = await renderTemplate('{{ "hi" |> myFilter }}', {}, { filters: { myFilter } });
      expect(result.trim()).toBe('hi!');
    });

    test('chained filters with kwargs', async () => {
      const addPrefix = (val, {prefix = ''} = {}) => prefix + val;
      const addSuffix = (val, {suffix = ''} = {}) => val + suffix;
      const result = await renderTemplate(
        '{{ "text" |> addPrefix(prefix="[[") |> addSuffix(suffix="]]") }}',
        {},
        { filters: { addPrefix, addSuffix } }
      );
      expect(result.trim()).toBe('[[text]]');
    });
  });

  describe('macros with kwargs', () => {
    test('macro with kwargs', async () => {
      const template = `
{% macro greet(name='World') %}
Hello {{ name }}
{% endmacro %}
{{ greet(name='Alice') }}
`;
      const result = await renderTemplate(template, {}, {});
      expect(result.trim()).toBe('Hello Alice');
    });

    test('macro with partial kwargs', async () => {
      const template = `
{% macro format(name='Anonymous', greeting='Hello') %}
{{ greeting }} {{ name }}
{% endmacro %}
{{ format(greeting="Hi") }}
`;
      const result = await renderTemplate(template, {}, {});
      expect(result.trim()).toBe('Hi Anonymous');
    });
  });

  describe('nested calls with kwargs', () => {
    test('nested calls - outer(inner(kwargs))', async () => {
      const inner = ({x = 'default'} = {}) => x;
      const outer = (val) => `[${val}]`;
      const result = await renderTemplate(
        '{{ outer(inner(x="nested")) }}',
        {},
        { globals: { inner, outer } }
      );
      expect(result.trim()).toBe('[nested]');
    });

    test('nested calls - both with kwargs', async () => {
      const inner2 = ({x = 1, y = 2} = {}) => x + y;
      const outer2 = ({val = 0} = {}) => val * 10;
      const result = await renderTemplate(
        '{{ outer2(val=(inner2(x=3, y=4))) }}',
        {},
        { globals: { inner2, outer2 } }
      );
      expect(result.trim()).toBe('70');
    });
  });

  describe('mixed positional and keyword args', () => {
    test('mixed positional and keyword args', async () => {
      const mixed = (a, {b = 'default_b', c = 'default_c'} = {}) => `${a}-${b}-${c}`;
      const result = await renderTemplate(
        '{{ mixed("first", b="second") }}',
        {},
        { globals: { mixed } }
      );
      expect(result.trim()).toBe('first-second-default_c');
    });
  });
});

describe('JavaScript expression smoke tests', () => {
  const renderExpr = async (template: string, context: Record<string, unknown> = {}) => {
    return await render(template, context, mergeConfig({ autoescape: false }) as unknown as Record<string, unknown>);
  };

  test('JSON.stringify and JSON.parse work', async () => {
    const result = await renderExpr('{{ data |> tojson }}', { data: { a: 1, b: 'test' } });
    expect(result).toBe('{"a":1,"b":"test"}');
  });

  test('Math constants are available', async () => {
    expect(await renderExpr('{{ Math.PI }}')).toBe(String(Math.PI));
    expect(await renderExpr('{{ Math.E }}')).toBe(String(Math.E));
  });

  test('Math methods work in expressions', async () => {
    expect(await renderExpr('{{ Math.abs(-5) }}')).toBe('5');
    expect(await renderExpr('{{ Math.floor(4.7) }}')).toBe('4');
    expect(await renderExpr('{{ Math.ceil(4.1) }}')).toBe('5');
    expect(await renderExpr('{{ Math.round(4.5) }}')).toBe('5');
    expect(await renderExpr('{{ Math.sqrt(16) }}')).toBe('4');
    expect(await renderExpr('{{ Math.pow(2, 3) }}')).toBe('8');
    expect(await renderExpr('{{ Math.max(1, 5, 3) }}')).toBe('5');
    expect(await renderExpr('{{ Math.min(1, 5, 3) }}')).toBe('1');
  });

  test('Math.random works', async () => {
    const result = await renderExpr('{{ Math.random() }}');
    const num = parseFloat(result);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThan(1);
  });

  test('Object.keys, values, entries work', async () => {
    const data = { x: 1, y: 2 };
    expect(await renderExpr('{{ Object.keys(data) |> join(",") }}', { data })).toBe('x,y');
    expect(await renderExpr('{{ Object.values(data) |> join(",") }}', { data })).toBe('1,2');
  });

  test('Object methods work', async () => {
    const data = { a: 1, b: 2 };
    expect(await renderExpr('{{ Object.keys(data).length }}', { data })).toBe('2');
    expect(await renderExpr('{{ Object.values(data) |> join(",") }}', { data })).toBe('1,2');
    expect(await renderExpr('{{ Object.entries(data).length }}', { data })).toBe('2');
  });

  test('Array.isArray works', async () => {
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: [1, 2, 3] })).toBe('true');
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: { a: 1 } })).toBe('false');
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: "string" })).toBe('false');
  });

  test('Number.isNaN and isFinite work', async () => {
    expect(await renderExpr('{{ Number.isNaN(0) }}')).toBe('false');
    expect(await renderExpr('{{ Number.isNaN(0 / 0) }}')).toBe('true');
    expect(await renderExpr('{{ Number.isFinite(5) }}')).toBe('true');
    expect(await renderExpr('{{ Number.isFinite(1 / 0) }}')).toBe('false');
  });

  test('Date.now works', async () => {
    const before = Date.now();
    const result = await renderExpr('{{ Date.now() }}');
    const after = Date.now();
    const timestamp = Number(result);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  test('ternary operator works', async () => {
    expect(await renderExpr('{{ "yes" if true else "no" }}')).toBe('yes');
    expect(await renderExpr('{{ "yes" if false else "no" }}')).toBe('no');
    expect(await renderExpr('{{ x > 5 ? "big" : "small" }}', { x: 10 })).toBe('big');
    expect(await renderExpr('{{ x > 5 ? "big" : "small" }}', { x: 3 })).toBe('small');
  });

  test('nullish coalescing works', async () => {
    expect(await renderExpr('{{ a ?? "default" }}', { a: null })).toBe('default');
    expect(await renderExpr('{{ a ?? "default" }}', { a: undefined })).toBe('default');
    expect(await renderExpr('{{ a ?? "default" }}', { a: 0 })).toBe('0');
    expect(await renderExpr('{{ a ?? "default" }}', { a: "" })).toBe('');
  });

  test('optional chaining works', async () => {
    const user = { profile: { name: 'Ada' } };
    expect(await renderExpr('{{ user?.profile?.name }}', { user })).toBe('Ada');
    expect(await renderExpr('{{ user?.missing?.name }}', { user })).toBe('');
    expect(await renderExpr('{{ null?.name }}')).toBe('');
  });

  test('complex expressions work', async () => {
    const items = [1, 2, 3, 4, 5];
    expect(await renderExpr('{{ items |> sum }}', { items })).toBe('15');
    expect(await renderExpr('{{ items |> length }}', { items })).toBe('5');
    expect(await renderExpr('{{ items |> reverse |> join(",") }}', { items })).toBe('5,4,3,2,1');
  });

  test('string expressions work', async () => {
    expect(await renderExpr('{{ "hello" |> upper }}')).toBe('HELLO');
    expect(await renderExpr('{{ "WORLD" |> lower }}')).toBe('world');
    expect(await renderExpr('{{ "hello" |> capitalize }}')).toBe('Hello');
  });

  test('arithmetic expressions work', async () => {
    expect(await renderExpr('{{ 10 + 5 }}')).toBe('15');
    expect(await renderExpr('{{ 10 - 3 }}')).toBe('7');
    expect(await renderExpr('{{ 4 * 3 }}')).toBe('12');
    expect(await renderExpr('{{ 15 / 3 }}')).toBe('5');
    expect(await renderExpr('{{ 17 % 5 }}')).toBe('2');
    expect(await renderExpr('{{ 2 ** 4 }}')).toBe('16');
    expect(await renderExpr('{{ 10 // 3 }}')).toBe('3');
  });
});
// @ts-nocheck

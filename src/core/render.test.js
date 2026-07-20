import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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

  test('points at the failing template token inside a multiline caller template literal', async () => {
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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

  test('does not remap blocked context key caller locations as template offsets', async () => {
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
    const marker = 'BLOCKED_CONTEXT_KEY_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{{ password }}', { password: 'secret123' }, { dev: true, strictMode: true, blockedContextKeys: ['password'], jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1, _callerLocation: { fileName: filePath, lineNumber: markerLine } }).catch(e => e); // BLOCKED_CONTEXT_KEY_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('BLOCKED_CONTEXT_KEYS');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('password') + 1);
    expect(callerLine[err.colno - 1]).toBe('p');
  });

  test('points non-string template errors at the invalid template argument', async () => {
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
    const marker = 'STATEMENT_SLICE_LOCATION_' + 'MARKER';
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await render('{% if items[::0] %}ok{% endif %}', { items: [1, 2, 3] }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e); // STATEMENT_SLICE_LOCATION_MARKER
    const callerLine = source[err.lineno - 1];

    expect(err.code).toBe('SLICE_STEP');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('::0') + 3);
  });

  test('points native arithmetic errors inside statements at the operator', async () => {
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
    await expect(renderTemplate('{{ "a" + "2" }}')).resolves.toBe('a2');
    await expect(renderTemplate('{{ 5 is odd }}')).resolves.toBe('true');
    await expect(renderTemplate('{{ 4 is not odd }}')).resolves.toBe('true');
    await expect(renderTemplate('{{ 6 is divisibleby(3) }}')).resolves.toBe('true');
    await expect(renderTemplate('{{ 3 is custom }}', {}, { tests: { custom: value => value === 3 } })).resolves.toBe('true');
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
    const filePath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(filePath, 'utf8').split('\n');
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
      const formatUser = ({user: {firstName = 'Anonymous', lastName = ''} = {} } = {}) => firstName + ' ' + lastName;
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
        double: function({value = 0} = {}) { return value * 2; },
        triple: function({value = 0} = {}) { return value * 3; }
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

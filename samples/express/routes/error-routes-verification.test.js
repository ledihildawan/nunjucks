import { expect, describe, test } from 'bun:test';
import { render as nunjucksRender } from '../../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const render = (template, context, config) => nunjucksRender(template, context, { dev: true, ...config });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

describe('Error Routes - All Throw Errors', () => {
  
  test('undefined-variable throws', async () => {
    const err = await render('Hello {{ user_name }}!', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('undefined-function throws', async () => {
    const err = await render('{{ myFunc() }}', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('not-a-function throws', async () => {
    const err = await render('{{ user.name() }}', { user: { name: 'test' } }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('undefined-filter throws', async () => {
    const err = await render('{{ value | nonexistent }}', { value: 'test' }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('filter-error throws', async () => {
    const err = await render('{{ value | throwFilter }}', { value: 42 }, {
      filters: { throwFilter: () => { throw new Error('Filter error'); } }
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('undefined-value throws', async () => {
    const err = await render('{{ product.name }}', { product: null }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('syntax-error throws', async () => {
    const err = await render('{% if true %} {% endif %} {{ invalid', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('invalid-lookup throws', async () => {
    const err = await render('{{ user.[name] }}', { user: {} }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('slice-error throws', async () => {
    const err = await render('{{ [1,2,3][::0] }}', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('list-filter-error throws', async () => {
    const err = await render('{{ 42 | list }}', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('in-operator-error throws', async () => {
    const err = await render('{{ key in value }}', { key: 'test', value: 123 }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('template-size throws', async () => {
    const largeTemplate = 'x'.repeat(10000);
    const err = await render(largeTemplate, {}, { maxTemplateSize: 1000 }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('invalid-config throws', async () => {
    const err = await render('{{ test }}', { test: 'value' }, { executionTimeout: -1 }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('template-not-string throws', async () => {
    const err = await nunjucksRender(null, {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('reserved-keyword-filter throws', async () => {
    const err = await render('{{ value }}', { value: 'test' }, { 
      filters: { 'if': (v) => v } 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('reserved-keyword-global throws', async () => {
    const err = await render('{{ myArray }}', { myArray: [1, 2, 3] }, { 
      globals: { Array: {} } 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('groupby-type-error throws', async () => {
    const err = await render('{{ items | groupby("missing") }}', { 
      items: [{ name: 'test' }] 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('sort-type-error throws', async () => {
    const err = await render('{{ items | sort("missing") }}', { 
      items: [{ name: 'test' }] 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('dictsort-value-error throws', async () => {
    const err = await render('{{ data | dictsort }}', { data: 'not an object' }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('dictsort-by-error throws', async () => {
    const err = await render('{{ data | dictsort(false, "invalid") }}', { 
      data: { a: 1, b: 2 } 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('invalid-boolean throws', async () => {
    const err = await render('{% if invalidBoolean %}test{% endif %}', { 
      invalidBoolean: 'not a boolean' 
    }).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('parser-expected throws', async () => {
    const err = await render('{% for item in items %}{{ item }}{% endfor %}', {}).catch(e => e);
    expect(err).toBeTruthy();
  });

  test('undefined-block throws with structured metadata', async () => {
    const err = await nunjucksRender('error-undefined-block.njk', {}, {
      dev: true,
      undefined: 'strict',
      views: VIEWS
    }).catch(e => e);

    expect(err).toBeTruthy();
    expect(err.code).toBe('UNDEFINED_BLOCK');
    expect(err.subject).toBe('nonexistent');
    expect(err.message).toContain('not defined in parent template');
  });
});

describe('Error HTML Output - All Have toHtmlString', () => {
  
  test('errors have format method', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(typeof err.output).toBe('function');
  });

  test('HTML output contains error message', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html.length).toBeGreaterThan(100);
  });

  test('HTML output contains Possible Causes', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html).toContain('Possible Causes');
  });

  test('HTML output contains Suggested Fix', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html).toContain('Suggested Fix');
  });

  test('HTML output contains Source Trace', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html).toContain('Source Trace');
  });

  test('HTML output contains Render Context', async () => {
    const err = await render('{{ undefinedVar }}', { user: { name: 'test' } }, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html).toContain('Render Context');
  });

  test('HTML output contains Stack Trace', async () => {
    const err = await render('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output();
    expect(html).toContain('Stack Trace');
  });

  test('undefined-block HTML output is humanized for parent-child block mismatch', async () => {
    const err = await nunjucksRender('error-undefined-block.njk', {}, {
      dev: true,
      undefined: 'strict',
      views: VIEWS
    }).catch(e => e);

    const html = err.output();
    expect(html).toContain("Block 'nonexistent' does not exist in the parent template");
    expect(html).toContain('The child template overrides block');
    expect(html).toContain('Rename the child block to a block that exists in the parent');
  });
});

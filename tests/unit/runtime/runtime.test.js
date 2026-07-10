import { expect, describe, test } from 'bun:test';
import nunjucks from '../../../nunjucks/index.js';

var Environment = nunjucks.Environment;
var Template = nunjucks.Template;
var templatesPath = 'tests/templates';
var Loader = nunjucks.FileSystemLoader;

describe('runtime', function() {
  test('should report the failed function calls to symbols', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true });
    var t = new Template('{{ foo("cvan") }}', env);
    try {
      await t.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/Unable to call `foo`, which is undefined/);
    }
  });

  test('should report the failed function calls to lookups', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true });
    var t = new Template('{{ foo["bar"]("cvan") }}', env);
    try {
      await t.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/foo\["bar"\]/);
    }
  });

  test('should report the failed function calls to calls', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true });
    var t = new Template('{{ foo.bar("second call") }}', env);
    try {
      await t.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/foo\["bar"\]/);
    }
  });

  test('should report full function name in error', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true });
    var t = new Template('{{ foo.barThatIsLongerThanTen() }}', env);
    try {
      await t.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/foo\["barThatIsLongerThanTen"\]/);
    }
  });

  test('should report the failed function calls w/multiple args', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true });

    var t1 = new Template('{{ foo.bar("multiple", "args") }}', env);
    try {
      await t1.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/foo\["bar"\]/);
    }

    var t2 = new Template('{{ foo["bar"]["zip"]("multiple", "args") }}', env);
    try {
      await t2.render({});
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/foo\["bar"\]\["zip"\]/);
    }
  });

  test('should allow for undefined macro arguments in the last position', async function() {
    var env = new Environment(new Loader(templatesPath), { dev: true, throwOnUndefined: false });
    var t = new Template(
      '{% macro foo(bar, baz) %}' +
      '{{ bar }} {{ baz }}{% endmacro %}' +
      '{{ foo("hello", nosuchvar) }}',
      env
    );
    var res = await t.render({});
    expect(res).toBe('hello ');
  });

  test('should allow for objects without a prototype macro arguments in the last position', async function() {
    var noProto = Object.create(null);
    noProto.qux = 'world';

    var env = new Environment(new Loader(templatesPath), { dev: true, throwOnUndefined: false });
    var t = new Template(
      '{% macro foo(bar, baz) %}' +
      '{{ bar }} {{ baz.qux }}{% endmacro %}' +
      '{{ foo("hello", noProto) }}',
      env
    );
    var res = await t.render({ noProto: noProto });
    expect(res).toBe('hello world');
  });

  test('should not read variables property from Object.prototype', async function() {
    var payload = 'function(){ return 1+2; }()';
    var data = {};
    Object.getPrototypeOf(data).payload = payload;

    var env = new Environment(new Loader(templatesPath), { dev: true });
    var t = new Template('{{ payload }}', env);
    var res = await t.render(data);
    expect(res).toBe(payload);
    delete Object.getPrototypeOf(data).payload;
  });
});
